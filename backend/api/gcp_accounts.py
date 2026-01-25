"""GCP 账号管理 API"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..models.gcp_account import (
    GCPAccount,
    GCPAccountCreate,
    GCPAccountResponse,
    GCPAccountUpdate,
    GCPCredentialValidationResult,
)
from ..services.audit_logger import get_audit_logger
from ..services.gcp_account_storage_postgresql import get_gcp_account_storage_postgresql
from ..services.gcp_credential_manager import get_gcp_credential_manager
from ..services.user_storage import get_user_storage
from ..utils.auth import get_current_admin_user, get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gcp-accounts", tags=["gcp-accounts"])


# 辅助函数：兼容dict和对象
def _get_attr(obj: Any, key: str, default=None):
    """获取属性，兼容dict和对象"""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


@router.post("/", response_model=GCPAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_gcp_account(
    account_create: GCPAccountCreate, current_user: dict = Depends(get_current_admin_user)
):
    """添加新的 GCP 账号

    步骤：
    1. 验证 Service Account JSON Key 有效性
    2. 加密凭证
    3. 保存到数据库
    4. 返回脱敏后的账号信息

    Returns:
        GCPAccountResponse: 创建的账号信息（脱敏）

    Raises:
        HTTPException 400: 凭证验证失败
        HTTPException 409: 账号名称已存在
    """
    credential_manager = get_gcp_credential_manager()
    account_storage = get_gcp_account_storage_postgresql()

    logger.info("GCP - Name: %s", account_create.account_name)

    # 1. 验证凭证
    logger.info("🔍 验证 GCP Service Account...")
    validation = credential_manager.validate_credentials(account_create.service_account_json)

    if not validation["valid"]:
        logger.error(": %s", validation['error'])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"凭证验证失败: {validation['error']}"
        )

    logger.info(
        f"✅ 凭证验证成功 - Project: {validation['project_id']}, "
        f"SA: {validation['service_account_email']}"
    )

    # 2. 加密凭证
    try:
        encrypted_credentials = credential_manager.encrypt_credentials(
            account_create.service_account_json
        )
        logger.info("🔐 Service Account JSON 已加密")
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"加密失败: {str(e)}"
        )

    # 3. 创建账号对象
    gcp_account = GCPAccount(
        org_id=current_user["org_id"],  # 添加组织ID
        account_name=account_create.account_name,
        project_id=validation["project_id"],
        service_account_email=validation["service_account_email"],
        credentials_encrypted=encrypted_credentials,
        description=account_create.description,
        organization_id=validation["organization_id"],
        billing_account_id=validation["billing_account_id"],
        billing_export_project_id=account_create.billing_export_project_id,
        billing_export_dataset=account_create.billing_export_dataset,
        billing_export_table=account_create.billing_export_table,
        is_verified=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    # 4. 保存到数据库
    try:
        saved_account = account_storage.create_account(gcp_account)
        logger.info("GCP - ID: %s", gcp_account.id)

        # 记录审计日志
        audit_logger = get_audit_logger()
        audit_logger.log_account_create(
            user_id=current_user["id"],
            org_id=current_user["org_id"],
            account_id=gcp_account.id,
            account_type="gcp",
            alias=account_create.account_name,
        )
    except ValueError as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"账号保存失败: {str(e)}"
        )

    # 4.5. 自动提取并更新 billing_account_id（如果配置了 BigQuery）
    if (
        account_create.billing_export_dataset
        and account_create.billing_export_table
        and not gcp_account.billing_account_id
    ):
        try:
            from backend.services.gcp_credentials_provider import get_gcp_credentials_provider

            credentials_provider = get_gcp_credentials_provider()

            logger.info("🔍 尝试从 BigQuery 自动提取 billing_account_id...")
            extracted_billing_id = credentials_provider.extract_billing_account_id(gcp_account.id)

            if extracted_billing_id:
                # 更新账号的 billing_account_id
                gcp_account.billing_account_id = extracted_billing_id
                account_storage.update_account(gcp_account.id, gcp_account)
                logger.info("billing_account_id: %s", extracted_billing_id)
            else:
                logger.warning("⚠️ 未能从 BigQuery 提取 billing_account_id")
        except Exception as e:
            # 不影响账号创建流程，只记录警告
            logger.warning("billing_account_id : %s", e)

    # 5. 返回响应（脱敏）
    return GCPAccountResponse(
        id=gcp_account.id,
        org_id=gcp_account.org_id,
        account_name=gcp_account.account_name,
        description=gcp_account.description,
        project_id=gcp_account.project_id,
        service_account_email=gcp_account.service_account_email,
        service_account_email_masked=credential_manager.mask_service_account_email(
            gcp_account.service_account_email
        ),
        is_verified=gcp_account.is_verified,
        created_at=gcp_account.created_at,
        updated_at=gcp_account.updated_at,
        organization_id=gcp_account.organization_id,
        billing_account_id=gcp_account.billing_account_id,
    )


@router.get("/", response_model=list[GCPAccountResponse])
async def list_gcp_accounts(current_user: dict = Depends(get_current_user)):
    """获取当前用户有权限的GCP账号列表

    权限过滤逻辑：
    - 管理员：返回所有账号
    - 普通用户：只返回被授权的账号

    Returns:
        List[GCPAccountResponse]: 账号列表（脱敏，已过滤权限）
    """
    account_storage = get_gcp_account_storage_postgresql()
    credential_manager = get_gcp_credential_manager()
    user_storage = get_user_storage()

    logger.info(
        f"📋 获取 GCP 账号列表 - Org: {current_user['org_id']}, User: {current_user['username']}, Role: {current_user['role']}"
    )

    # 获取当前组织的所有账号（多租户隔离）
    org_accounts = account_storage.list_accounts(org_id=current_user["org_id"])

    # 权限过滤
    if current_user["role"] == "admin":
        # 管理员可以看到本组织所有账号
        logger.info("✅ 管理员访问，返回本组织全部 {len(org_accounts)} 个GCP账号")
        accounts = org_accounts
    else:
        # 普通用户只能看到被授权的账号
        authorized_account_ids = user_storage.get_user_gcp_accounts(current_user["id"])
        # 兼容dict和对象两种返回类型
        accounts = [acc for acc in org_accounts if _get_attr(acc, "id") in authorized_account_ids]
        logger.info(
            f"✅ 普通用户访问 - 组织账号: {len(org_accounts)}, "
            f"授权账号: {len(authorized_account_ids)}, "
            f"返回: {len(accounts)} 个GCP账号"
        )

    response = [
        GCPAccountResponse(
            id=_get_attr(acc, "id"),
            org_id=_get_attr(acc, "org_id"),
            account_name=_get_attr(acc, "account_name"),
            description=_get_attr(acc, "description"),
            project_id=_get_attr(acc, "project_id"),
            service_account_email=_get_attr(acc, "service_account_email"),
            service_account_email_masked=credential_manager.mask_service_account_email(
                _get_attr(acc, "service_account_email")
            ),
            is_verified=_get_attr(acc, "is_verified", False),
            created_at=_get_attr(acc, "created_at"),
            updated_at=_get_attr(acc, "updated_at"),
            organization_id=_get_attr(acc, "organization_id"),
            billing_account_id=_get_attr(acc, "billing_account_id"),
            billing_export_project_id=_get_attr(acc, "billing_export_project_id"),
            billing_export_dataset=_get_attr(acc, "billing_export_dataset"),
            billing_export_table=_get_attr(acc, "billing_export_table"),
        )
        for acc in accounts
    ]

    logger.info("✅ 返回 {len(response)} 个 GCP 账号")
    return response


@router.get("/{account_id}", response_model=GCPAccountResponse)
async def get_gcp_account(account_id: str, current_user: dict = Depends(get_current_user)):
    """获取单个 GCP 账号详情（多租户架构）

    Args:
        account_id: 账号 ID
        current_user: 当前用户（用于组织隔离）

    Returns:
        GCPAccountResponse: 账号信息（脱敏）

    Raises:
        HTTPException 404: 账号不存在
        HTTPException 403: 账号不属于当前组织
    """
    account_storage = get_gcp_account_storage_postgresql()
    credential_manager = get_gcp_credential_manager()

    logger.info("GCP - Org: %s, ID: %s", current_user['org_id'], account_id)

    account = account_storage.get_account(account_id)

    if not account:
        logger.warning("GCP - ID: %s", account_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在: {account_id}"
        )

    # 多租户隔离检查
    if _get_attr(account, "org_id") != current_user["org_id"]:
        logger.warning(
            f"⚠️  尝试访问其他组织的GCP账号 - User Org: {current_user['org_id']}, Account Org: {_get_attr(account, 'org_id')}"
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该账号")

    return GCPAccountResponse(
        id=_get_attr(account, "id"),
        org_id=_get_attr(account, "org_id"),
        account_name=_get_attr(account, "account_name"),
        description=_get_attr(account, "description"),
        project_id=_get_attr(account, "project_id"),
        service_account_email=_get_attr(account, "service_account_email"),
        service_account_email_masked=credential_manager.mask_service_account_email(
            _get_attr(account, "service_account_email")
        ),
        is_verified=_get_attr(account, "is_verified", False),
        created_at=_get_attr(account, "created_at"),
        updated_at=_get_attr(account, "updated_at"),
        organization_id=_get_attr(account, "organization_id"),
        billing_account_id=_get_attr(account, "billing_account_id"),
        billing_export_project_id=_get_attr(account, "billing_export_project_id"),
        billing_export_dataset=_get_attr(account, "billing_export_dataset"),
        billing_export_table=_get_attr(account, "billing_export_table"),
    )


@router.put("/{account_id}", response_model=GCPAccountResponse)
async def update_gcp_account(
    account_id: str,
    account_update: GCPAccountUpdate,
    current_user: dict = Depends(get_current_user),
):
    """更新 GCP 账号信息（多租户架构）

    Args:
        account_id: 账号 ID
        account_update: 更新的字段
        current_user: 当前用户（用于组织隔离）

    Returns:
        GCPAccountResponse: 更新后的账号信息

    Raises:
        HTTPException 404: 账号不存在或不属于该组织
        HTTPException 409: 名称在当前组织内冲突
    """
    account_storage = get_gcp_account_storage_postgresql()
    credential_manager = get_gcp_credential_manager()

    logger.info("GCP - Org: %s, ID: %s", current_user['org_id'], account_id)

    try:
        updated_account = account_storage.update_account(
            account_id,
            org_id=current_user["org_id"],
            account_name=account_update.account_name,
            description=account_update.description,
            billing_export_project_id=account_update.billing_export_project_id,
            billing_export_dataset=account_update.billing_export_dataset,
            billing_export_table=account_update.billing_export_table,
        )
    except ValueError as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    if not updated_account:
        logger.warning("GCP - ID: %s", account_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在: {account_id}"
        )

    logger.info("GCP - ID: %s", account_id)

    return GCPAccountResponse(
        id=_get_attr(updated_account, "id"),
        org_id=_get_attr(updated_account, "org_id"),
        account_name=_get_attr(updated_account, "account_name"),
        description=_get_attr(updated_account, "description"),
        project_id=_get_attr(updated_account, "project_id"),
        service_account_email=_get_attr(updated_account, "service_account_email"),
        service_account_email_masked=credential_manager.mask_service_account_email(
            _get_attr(updated_account, "service_account_email")
        ),
        is_verified=_get_attr(updated_account, "is_verified", False),
        created_at=_get_attr(updated_account, "created_at"),
        updated_at=_get_attr(updated_account, "updated_at"),
        organization_id=_get_attr(updated_account, "organization_id"),
        billing_account_id=_get_attr(updated_account, "billing_account_id"),
        billing_export_project_id=_get_attr(updated_account, "billing_export_project_id"),
        billing_export_dataset=_get_attr(updated_account, "billing_export_dataset"),
        billing_export_table=updated_account.billing_export_table,
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gcp_account(account_id: str, current_user: dict = Depends(get_current_admin_user)):
    """删除 GCP 账号（多租户架构）

    Args:
        account_id: 账号 ID
        current_user: 当前用户（必须是管理员，用于组织隔离）

    Raises:
        HTTPException 404: 账号不存在或不属于该组织
    """
    account_storage = get_gcp_account_storage_postgresql()

    logger.info("GCP - Org: %s, ID: %s", current_user['org_id'], account_id)

    deleted = account_storage.delete_account(account_id, org_id=current_user["org_id"])

    if not deleted:
        logger.warning(
            f"⚠️  GCP 账号不存在或不属于该组织 - Org: {current_user['org_id']}, ID: {account_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在或无权访问: {account_id}"
        )

    logger.info("GCP - ID: %s", account_id)

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log_account_delete(
        user_id=current_user["id"],
        org_id=current_user["org_id"],
        account_id=account_id,
        account_type="gcp",
    )


@router.post("/{account_id}/validate", response_model=GCPCredentialValidationResult)
async def validate_gcp_account_credentials(account_id: str):
    """重新验证 GCP 账号凭证

    用于检查凭证是否仍然有效。

    Args:
        account_id: 账号 ID

    Returns:
        GCPCredentialValidationResult: 验证结果

    Raises:
        HTTPException 404: 账号不存在
    """
    account_storage = get_gcp_account_storage_postgresql()
    credential_manager = get_gcp_credential_manager()

    logger.info("GCP - ID: %s", account_id)

    account = account_storage.get_account(account_id)

    if not account:
        logger.warning("GCP - ID: %s", account_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在: {account_id}"
        )

    # 解密凭证
    try:
        credentials_json = credential_manager.decrypt_credentials(
            _get_attr(account, "credentials_encrypted")
        )
    except Exception as e:
        logger.error(": %s", e)
        return GCPCredentialValidationResult(valid=False, error=f"解密失败: {str(e)}")

    # 验证凭证
    validation = credential_manager.validate_credentials(credentials_json)

    if validation["valid"]:
        logger.info("- Project: %s", validation['project_id'])
    else:
        logger.error(": %s", validation['error'])

    return GCPCredentialValidationResult(**validation)


@router.get("/statistics/summary")
async def get_gcp_statistics():
    """获取 GCP 账号统计信息

    Returns:
        dict: 统计信息
    """
    account_storage = get_gcp_account_storage_postgresql()

    stats = account_storage.get_statistics()

    logger.info("GCP : %s", stats)

    return stats
