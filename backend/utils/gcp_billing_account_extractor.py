"""
GCP Billing Account ID 自动提取工具

用于为已存在的 GCP 账号自动提取并更新 billing_account_id
"""


from backend.services.gcp_account_storage_postgresql import get_gcp_account_storage_postgresql
from backend.services.gcp_credentials_provider import get_gcp_credentials_provider

import logging

logger = logging.getLogger(__name__)


def extract_billing_account_for_all() -> dict[str, any]:
    """为所有未设置 billing_account_id 的账号自动提取

    Returns:
        统计信息: {
            'total': 总账号数,
            'need_update': 需要更新的账号数,
            'success': 成功提取的数量,
            'failed': 失败的数量,
            'details': 详细结果列表
        }
    """
    account_storage = get_gcp_account_storage_postgresql()
    credentials_provider = get_gcp_credentials_provider()

    logger.info("🚀 开始为所有 GCP 账号提取 billing_account_id...")

    # 获取所有账号
    all_accounts = account_storage._execute_query(
        "SELECT id, account_name, billing_account_id, billing_export_dataset, billing_export_table FROM gcp_accounts"
    )

    total = len(all_accounts)
    need_update = []
    results = []

    # 筛选需要更新的账号
    for acc in all_accounts:
        acc_id, acc_name, billing_id, dataset, table = acc

        # 条件：没有 billing_account_id 但配置了 BigQuery
        if not billing_id and dataset and table:
            need_update.append({"id": acc_id, "name": acc_name, "dataset": dataset, "table": table})

    logger.info(f"📊 统计 - 总账号: {total}, 需要更新: {len(need_update)}")

    success = 0
    failed = 0

    # 逐个提取
    for acc_info in need_update:
        try:
            logger.info(f"🔍 处理账号: {acc_info['name']} ({acc_info['id']})")

            extracted_id = credentials_provider.extract_billing_account_id(acc_info["id"])

            if extracted_id:
                # 更新数据库
                account_storage._execute_update(
                    "UPDATE gcp_accounts SET billing_account_id = %s, updated_at = NOW() WHERE id = %s",
                    (extracted_id, acc_info["id"]),
                )

                success += 1
                results.append(
                    {
                        "account_id": acc_info["id"],
                        "account_name": acc_info["name"],
                        "status": "success",
                        "billing_account_id": extracted_id,
                    }
                )
                logger.info(f"✅ 成功: {acc_info['name']} → {extracted_id}")
            else:
                failed += 1
                results.append(
                    {
                        "account_id": acc_info["id"],
                        "account_name": acc_info["name"],
                        "status": "not_found",
                        "error": "No billing_account_id found in BigQuery",
                    }
                )
                logger.warning(f"⚠️ 未找到: {acc_info['name']}")

        except Exception as e:
            failed += 1
            results.append(
                {
                    "account_id": acc_info["id"],
                    "account_name": acc_info["name"],
                    "status": "error",
                    "error": str(e),
                }
            )
            logger.error(f"❌ 失败: {acc_info['name']} - {e}")

    summary = {
        "total": total,
        "need_update": len(need_update),
        "success": success,
        "failed": failed,
        "details": results,
    }

    logger.info(f"✅ 提取完成 - 成功: {success}, 失败: {failed}")
    return summary


def extract_billing_account_for_one(account_id: str) -> str | None:
    """为单个账号提取 billing_account_id

    Args:
        account_id: GCP 账号 ID

    Returns:
        提取到的 billing_account_id 或 None
    """
    account_storage = get_gcp_account_storage_postgresql()
    credentials_provider = get_gcp_credentials_provider()

    logger.info(f"🔍 为账号 {account_id} 提取 billing_account_id...")

    try:
        extracted_id = credentials_provider.extract_billing_account_id(account_id)

        if extracted_id:
            # 更新数据库
            account_storage._execute_update(
                "UPDATE gcp_accounts SET billing_account_id = %s, updated_at = NOW() WHERE id = %s",
                (extracted_id, account_id),
            )
            logger.info(f"✅ 成功提取并保存: {extracted_id}")
            return extracted_id
        else:
            logger.warning("⚠️ 未找到 billing_account_id")
            return None

    except Exception as e:
        logger.error(f"❌ 提取失败: {e}")
        return None


if __name__ == "__main__":
    # 可以直接运行此脚本来批量更新
    import sys

    sys.path.insert(0, "/app")

    result = extract_billing_account_for_all()

    print("\n" + "=" * 60)
    print("📊 提取结果汇总")
    print("=" * 60)
    print(f"总账号数: {result['total']}")
    print(f"需要更新: {result['need_update']}")
    print(f"成功: {result['success']}")
    print(f"失败: {result['failed']}")
    print("=" * 60)

    if result["details"]:
        print("\n详细结果:")
        for detail in result["details"]:
            status_emoji = "✅" if detail["status"] == "success" else "❌"
            print(
                f"{status_emoji} {detail['account_name']}: {detail.get('billing_account_id', detail.get('error'))}"
            )
