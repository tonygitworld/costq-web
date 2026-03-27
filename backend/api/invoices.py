"""客户侧 Invoice API - 只读 + tenant scope 校验"""

import logging

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.database import get_db
from backend.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/invoices", tags=["Invoice"])

_S3_BUCKET = "costq-storage"


@router.get("")
def list_invoices(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出当前租户的 Invoice（仅 generated 状态的最新版本）"""
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="无租户信息")

    rows = db.execute(
        text(
            """
            SELECT id, invoice_number, version, period_year,
                   period_month, cloud_cost_total, costq_fee,
                   total_amount, currency, status, generated_at,
                   created_at
            FROM invoices
            WHERE organization_id = :org_id
              AND status = 'generated'
            ORDER BY period_year DESC, period_month DESC,
                     version DESC
            """
        ),
        {"org_id": org_id},
    ).fetchall()

    # 每个账期只取最新版本
    seen = set()
    items = []
    for r in rows:
        period_key = (r[3], r[4])  # (year, month)
        if period_key in seen:
            continue
        seen.add(period_key)
        items.append({
            "id": str(r[0]),
            "invoice_number": r[1],
            "version": r[2],
            "period_year": r[3],
            "period_month": r[4],
            "cloud_cost_total": float(r[5] or 0),
            "costq_fee": float(r[6] or 0),
            "total_amount": float(r[7] or 0),
            "currency": r[8],
            "status": r[9],
            "generated_at": r[10].isoformat() if r[10] else None,
            "created_at": r[11].isoformat() if r[11] else None,
        })

    return {"items": items, "total": len(items)}


@router.get("/{invoice_id}/download")
def download_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取 Invoice PDF 下载链接（Presigned URL）

    tenant scope 校验：invoice 必须属于当前用户的 organization。
    """
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="无租户信息")

    row = db.execute(
        text(
            "SELECT organization_id, s3_path, status "
            "FROM invoices WHERE id = :id"
        ),
        {"id": invoice_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Invoice 不存在")

    # tenant scope 校验
    if str(row[0]) != str(org_id):
        raise HTTPException(status_code=403, detail="无权访问")

    if not row[1]:
        raise HTTPException(
            status_code=400, detail="Invoice PDF 尚未生成",
        )

    if row[2] != "generated":
        raise HTTPException(
            status_code=400, detail="Invoice 状态异常",
        )

    try:
        s3 = boto3.client("s3", region_name=settings.AWS_REGION)
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": _S3_BUCKET, "Key": row[1]},
            ExpiresIn=900,
        )
        return {"download_url": url, "expires_in": 900}
    except ClientError as e:
        logger.error(
            "Presigned URL 生成失败: %s", str(e), exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail="下载链接生成失败",
        )
