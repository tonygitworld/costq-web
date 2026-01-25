"""AWS 账号管理 API"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from ..models.aws_account import (
    AuthType,
    AWSAccount,
    AWSAccountCreate,
    AWSAccountCreateIAMRole,
    AWSAccountResponse,
    AWSAccountUpdate,
    CredentialValidationResult,
)
from ..services.account_storage import get_account_storage
from ..services.audit_logger import get_audit_logger
from ..services.credential_manager import get_credential_manager
from ..services.user_storage import get_user_storage
from ..utils.auth import get_current_admin_user, get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


# ========== 辅助函数 ==========


def build_account_response(account: AWSAccount, credential_manager=None) -> AWSAccountResponse:
    """构造账号响应对象（处理 AKSK 和 IAM Role 两种类型）

    Args:
        account: AWSAccount 对象
        credential_manager: 凭证管理器（AKSK 类型需要用于脱敏）

    Returns:
        AWSAccountResponse: 响应对象
    """
    # 基础字段
    response_data = {
        "id": account.id,
        "org_id": account.org_id,
        "alias": account.alias,
        "auth_type": account.auth_type if hasattr(account, "auth_type") else AuthType.AKSK,
        "region": account.region,
        "description": account.description,
        "account_id": account.account_id,
        "arn": account.arn,
        "is_verified": account.is_verified,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }

    # 根据认证类型添加特定字段
    if hasattr(account, "auth_type") and account.auth_type == AuthType.IAM_ROLE:
        # IAM Role 类型
        response_data["role_arn"] = account.role_arn
        response_data["session_duration"] = account.session_duration
        response_data["access_key_id_masked"] = None
    else:
        # AKSK 类型
        if credential_manager and hasattr(account, "access_key_id"):
            response_data["access_key_id_masked"] = credential_manager.mask_access_key(
                account.access_key_id
            )
        else:
            response_data["access_key_id_masked"] = "AKIA...****"
        response_data["role_arn"] = None
        response_data["session_duration"] = None

    return AWSAccountResponse(**response_data)


@router.post("/", response_model=AWSAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_create: AWSAccountCreate, current_user: dict = Depends(get_current_user)
):
    """添加新的 AWS 账号（多租户架构）

    步骤：
    1. 验证凭证有效性
    2. 加密 Secret Access Key
    3. 保存到数据库（关联到当前用户的组织）
    4. 返回脱敏后的账号信息

    Returns:
        AWSAccountResponse: 创建的账号信息（脱敏）

    Raises:
        HTTPException 400: 凭证验证失败
        HTTPException 409: 账号别名在当前组织内已存在
    """
    credential_manager = get_credential_manager()
    account_storage = get_account_storage()

    logger.info(
        f"📝 创建账号请求 - Org: {current_user['org_id']}, User: {current_user['username']}, Alias: {account_create.alias}"
    )

    # 1. 验证凭证
    logger.info("🔍 验证 AWS 凭证...")
    validation = credential_manager.validate_credentials(
        account_create.access_key_id, account_create.secret_access_key, account_create.region
    )

    if not validation["valid"]:
        logger.error(": %s", validation['error'])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"凭证验证失败: {validation['error']}"
        )

    logger.info("- Account: %s, ARN: %s", validation['account_id'], validation['arn'])

    # 2. 加密 Secret Access Key
    try:
        encrypted_secret = credential_manager.encrypt_secret_key(account_create.secret_access_key)
        logger.info("🔐 Secret Access Key 已加密")
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"加密失败: {str(e)}"
        )

    # 3. 创建账号对象（关联到当前用户的组织）
    aws_account = AWSAccount(
        org_id=current_user["org_id"],
        alias=account_create.alias,
        access_key_id=account_create.access_key_id,
        secret_access_key_encrypted=encrypted_secret,
        region=account_create.region,
        description=account_create.description,
        account_id=validation["account_id"],
        arn=validation["arn"],
        is_verified=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    # 4. 保存到数据库
    try:
        saved_account = account_storage.create_account(aws_account)
        logger.info("- ID: %s", aws_account.id)

        # 记录审计日志
        audit_logger = get_audit_logger()
        audit_logger.log_account_create(
            user_id=current_user["id"],
            org_id=current_user["org_id"],
            account_id=aws_account.id,
            account_type="aws",
            alias=account_create.alias,
        )
    except ValueError as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"账号保存失败: {str(e)}"
        )

    # 5. 返回响应（脱敏）
    return build_account_response(aws_account, credential_manager)


@router.get("/", response_model=list[AWSAccountResponse])
async def list_accounts(current_user: dict = Depends(get_current_user)):
    """获取当前组织的AWS账号列表（多租户架构）

    多租户隔离：
    - 只返回当前用户所属组织的账号

    权限过滤逻辑：
    - 管理员：返回本组织所有账号
    - 普通用户：只返回被授权的账号

    Returns:
        List[AWSAccountResponse]: 账号列表（脱敏，已过滤组织和权限）
    """
    account_storage = get_account_storage()
    credential_manager = get_credential_manager()
    user_storage = get_user_storage()

    logger.info(
        f"📋 获取账号列表 - Org: {current_user['org_id']}, User: {current_user['username']}, Role: {current_user['role']}"
    )

    # 获取当前组织的所有账号（多租户隔离）
    org_accounts = account_storage.list_accounts(org_id=current_user["org_id"])

    # 权限过滤
    if current_user["role"] == "admin":
        # 管理员可以看到本组织所有账号
        logger.info("✅ 管理员访问，返回本组织全部 {len(org_accounts)} 个账号")
        accounts = org_accounts
    else:
        # 普通用户只能看到被授权的账号
        authorized_account_ids = user_storage.get_user_aws_accounts(current_user["id"])
        accounts = [acc for acc in org_accounts if acc["id"] in authorized_account_ids]
        logger.info(
            f"✅ 普通用户访问 - 组织账号: {len(org_accounts)}, "
            f"授权账号: {len(authorized_account_ids)}, "
            f"返回: {len(accounts)} 个账号"
        )

    # 转换为响应格式（脱敏）
    from datetime import datetime

    from backend.models.aws_account import AuthType, AWSAccount

    response = []
    for acc in accounts:
        # 将字典转换为 AWSAccount 对象
        account_obj = AWSAccount(
            id=acc["id"],
            org_id=acc["org_id"],
            alias=acc["alias"],
            auth_type=AuthType(acc.get("auth_type", "aksk")),
            access_key_id=acc.get("access_key_id"),
            secret_access_key_encrypted=acc.get("secret_access_key_encrypted"),
            role_arn=acc.get("role_arn"),
            session_duration=acc.get("session_duration") or 3600,  # 默认3600秒
            region=acc["region"],
            description=acc.get("description"),
            account_id=acc.get("account_id"),
            arn=acc.get("arn"),
            is_verified=acc.get("is_verified", False),
            created_at=acc["created_at"]
            if isinstance(acc["created_at"], datetime)
            else datetime.fromisoformat(str(acc["created_at"])),
            updated_at=acc["updated_at"]
            if isinstance(acc["updated_at"], datetime)
            else datetime.fromisoformat(str(acc["updated_at"])),
        )

        # 使用统一的响应构建函数
        response.append(build_account_response(account_obj, credential_manager))

    logger.info("✅ 返回 {len(response)} 个账号")
    return response


@router.get("/{account_id}", response_model=AWSAccountResponse)
async def get_account(account_id: str, current_user: dict = Depends(get_current_user)):
    """获取单个账号详情（多租户架构）

    多租户隔离：
    - 账号必须属于当前用户的组织

    权限检查：
    - 管理员：可以查看本组织任何账号
    - 普通用户：只能查看被授权的账号

    Args:
        account_id: 账号 ID

    Returns:
        AWSAccountResponse: 账号信息（脱敏）

    Raises:
        HTTPException 404: 账号不存在
        HTTPException 403: 无权访问（不属于该组织或未授权）
    """
    account_storage = get_account_storage()
    credential_manager = get_credential_manager()
    user_storage = get_user_storage()

    logger.info(
        f"🔍 获取账号 - Org: {current_user['org_id']}, ID: {account_id}, User: {current_user['username']}"
    )

    account = account_storage.get_account(account_id)

    if not account:
        logger.warning("- ID: %s", account_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在: {account_id}"
        )

    # 多租户隔离检查
    if account["org_id"] != current_user["org_id"]:
        logger.warning(
            f"⚠️  尝试访问其他组织的账号 - User Org: {current_user['org_id']}, Account Org: {account['org_id']}"
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该账号")

    # 权限检查
    if current_user["role"] != "admin":
        authorized_account_ids = user_storage.get_user_aws_accounts(current_user["id"])
        if account_id not in authorized_account_ids:
            logger.warning(
                f"⚠️  用户无权访问账号 - User: {current_user['username']}, Account: {account_id}"
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该账号")

    return AWSAccountResponse(
        id=account["id"],
        org_id=account["org_id"],
        alias=account["alias"],
        access_key_id_masked=credential_manager.mask_access_key(account["access_key_id"]),
        region=account["region"],
        description=account.get("description"),
        account_id=account.get("account_id"),
        arn=account.get("arn"),
        is_verified=account.get("is_verified", False),
        created_at=account["created_at"],
        updated_at=account["updated_at"],
    )


@router.put("/{account_id}", response_model=AWSAccountResponse)
async def update_account(
    account_id: str,
    account_update: AWSAccountUpdate,
    current_user: dict = Depends(get_current_user),
):
    """更新账号信息（多租户架构）

    Args:
        account_id: 账号 ID
        account_update: 更新的字段
        current_user: 当前用户（用于组织隔离）

    Returns:
        AWSAccountResponse: 更新后的账号信息

    Raises:
        HTTPException 404: 账号不存在或不属于该组织
        HTTPException 409: 别名在当前组织内冲突
    """
    account_storage = get_account_storage()
    credential_manager = get_credential_manager()

    logger.info("- Org: %s, ID: %s", current_user['org_id'], account_id)

    try:
        updated_account = account_storage.update_account(
            account_id,
            org_id=current_user["org_id"],
            alias=account_update.alias,
            region=account_update.region,
            description=account_update.description,
        )
    except ValueError as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    if not updated_account:
        logger.warning(
            f"⚠️  账号不存在或不属于该组织 - Org: {current_user['org_id']}, ID: {account_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在或无权访问: {account_id}"
        )

    logger.info("- ID: %s", account_id)

    return AWSAccountResponse(
        id=updated_account["id"],
        org_id=updated_account["org_id"],
        alias=updated_account["alias"],
        access_key_id_masked=credential_manager.mask_access_key(updated_account["access_key_id"]),
        region=updated_account["region"],
        description=updated_account.get("description"),
        account_id=updated_account.get("account_id"),
        arn=updated_account.get("arn"),
        is_verified=updated_account.get("is_verified", False),
        created_at=updated_account["created_at"],
        updated_at=updated_account["updated_at"],
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: str, current_user: dict = Depends(get_current_admin_user)):
    """删除账号（多租户架构）

    Args:
        account_id: 账号 ID
        current_user: 当前用户（必须是管理员，用于组织隔离）

    Raises:
        HTTPException 404: 账号不存在或不属于该组织
    """
    account_storage = get_account_storage()

    logger.info("- Org: %s, ID: %s", current_user['org_id'], account_id)

    deleted = account_storage.delete_account(account_id, org_id=current_user["org_id"])

    if not deleted:
        logger.warning(
            f"⚠️  账号不存在或不属于该组织 - Org: {current_user['org_id']}, ID: {account_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在或无权访问: {account_id}"
        )

    logger.info("- ID: %s", account_id)

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log_account_delete(
        user_id=current_user["id"],
        org_id=current_user["org_id"],
        account_id=account_id,
        account_type="aws",
    )


@router.post("/{account_id}/validate", response_model=CredentialValidationResult)
async def validate_account_credentials(
    account_id: str, current_user: dict = Depends(get_current_admin_user)
):
    """重新验证账号凭证（多租户架构）

    用于检查凭证是否仍然有效。

    Args:
        account_id: 账号 ID
        current_user: 当前用户（必须是管理员，用于组织隔离）

    Returns:
        CredentialValidationResult: 验证结果

    Raises:
        HTTPException 404: 账号不存在或不属于该组织
        HTTPException 403: 账号不属于当前组织
    """
    account_storage = get_account_storage()
    credential_manager = get_credential_manager()

    logger.info("- Org: %s, ID: %s", current_user['org_id'], account_id)

    account = account_storage.get_account(account_id)

    if not account:
        logger.warning("- ID: %s", account_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"账号不存在: {account_id}"
        )

    # 多租户隔离检查
    if account.org_id != current_user["org_id"]:
        logger.warning(
            f"⚠️  尝试验证其他组织的账号 - User Org: {current_user['org_id']}, Account Org: {account.org_id}"
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该账号")

    # 解密 Secret Access Key
    try:
        secret_access_key = credential_manager.decrypt_secret_key(
            account.secret_access_key_encrypted
        )
    except Exception as e:
        logger.error(": %s", e)
        return CredentialValidationResult(valid=False, error=f"解密失败: {str(e)}")

    # 验证凭证
    validation = credential_manager.validate_credentials(
        account["access_key_id"], secret_access_key, account["region"]
    )

    if validation["valid"]:
        logger.info("- Account: %s", validation['account_id'])
    else:
        logger.error(": %s", validation['error'])

    return CredentialValidationResult(**validation)


@router.get("/statistics/summary")
async def get_statistics():
    """获取账号统计信息

    Returns:
        dict: 统计信息
    """
    account_storage = get_account_storage()

    stats = account_storage.get_statistics()

    logger.info(": %s", stats)

    return stats


# ========== IAM Role 相关端点 ==========


@router.get("/organizations/external-id", response_model=dict)
async def get_external_id(current_user: dict = Depends(get_current_user)):
    """获取当前组织的 External ID（用于 IAM Role 集成）

    External ID 用于 CloudFormation 部署 IAM Role 时填写，
    防止混淆代理人攻击。

    Returns:
        dict: External ID 和部署信息
            {
                "org_id": "组织ID",
                "external_id": "org-uuid",
                "cloudformation_template_url": "模板URL",
                "platform_account_id": "平台账号ID",
                "quick_create_url": "一键部署URL"
            }
    """
    from urllib.parse import urlencode

    from backend.services.user_storage_postgresql import UserStoragePostgreSQL

    user_storage = UserStoragePostgreSQL()

    # 获取或生成 External ID
    external_id = user_storage.get_organization_external_id(current_user["org_id"])

    # CloudFormation 配置
    cfn_template_url = "https://costq-storage.s3.amazonaws.com/cloudformation/costq-iam-role.yaml"
    platform_account_id = "000451883532"

    # 生成一键部署 URL
    cfn_params = {
        "templateURL": cfn_template_url,
        "stackName": "CostQRole",
        "param_CostQPlatformAccountId": platform_account_id,
        "param_ExternalId": external_id,
        "param_RoleName": "CostQRole",
    }
    quick_create_url = f"https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?{urlencode(cfn_params)}"

    logger.info("External ID - Org: %s, External ID: %s", current_user['org_id'], external_id)

    return {
        "org_id": current_user["org_id"],
        "external_id": external_id,
        "cloudformation_template_url": cfn_template_url,
        "platform_account_id": platform_account_id,
        "quick_create_url": quick_create_url,
    }


@router.post("/iam-role", response_model=AWSAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_iam_role_account(
    account_create: AWSAccountCreateIAMRole, current_user: dict = Depends(get_current_user)
):
    """添加新的 AWS 账号（IAM Role 方式）

    步骤：
    1. 获取组织的 External ID
    2. 验证 IAM Role（尝试 AssumeRole）
    3. 提取 AWS Account ID
    4. 保存到数据库

    Args:
        account_create: IAM Role 账号创建请求

    Returns:
        AWSAccountResponse: 创建的账号信息

    Raises:
        HTTPException 400: IAM Role 验证失败
        HTTPException 409: 账号别名已存在
    """
    from backend.services.aws_credentials_provider import validate_iam_role
    from backend.services.user_storage_postgresql import UserStoragePostgreSQL

    account_storage = get_account_storage()
    user_storage = UserStoragePostgreSQL()

    logger.info(
        f"📝 创建 IAM Role 账号 - "
        f"Org: {current_user['org_id']}, "
        f"User: {current_user['username']}, "
        f"Alias: {account_create.alias}, "
        f"Role ARN: {account_create.role_arn}"
    )

    # 1. 获取 External ID
    external_id = user_storage.get_organization_external_id(current_user["org_id"])

    # 2. 验证 IAM Role
    logger.info("🔍 验证 IAM Role...")
    validation = validate_iam_role(
        role_arn=account_create.role_arn, external_id=external_id, region=account_create.region
    )

    if not validation["valid"]:
        logger.error("IAM Role : %s", validation['error'])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"IAM Role 验证失败: {validation['error']}",
        )

    logger.info(
        f"✅ IAM Role 验证成功 - Account: {validation['account_id']}, ARN: {validation['arn']}"
    )

    # 3. 创建账号对象
    from backend.models.aws_account import AuthType, AWSAccount

    aws_account = AWSAccount(
        org_id=current_user["org_id"],
        alias=account_create.alias,
        auth_type=AuthType.IAM_ROLE,
        role_arn=account_create.role_arn,
        session_duration=account_create.session_duration,
        region=account_create.region,
        description=account_create.description,
        account_id=validation["account_id"],
        arn=validation["arn"],
        is_verified=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    # 4. 保存到数据库
    try:
        saved_account = account_storage.create_account(aws_account)
        logger.info("IAM Role - ID: %s", aws_account.id)

        # 记录审计日志
        audit_logger = get_audit_logger()
        audit_logger.log_account_create(
            user_id=current_user["id"],
            org_id=current_user["org_id"],
            account_id=aws_account.id,
            account_type="aws",
            alias=account_create.alias,
        )
    except ValueError as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"账号创建失败: {str(e)}"
        )

    # 5. 返回响应（脱敏）
    return build_account_response(saved_account)
