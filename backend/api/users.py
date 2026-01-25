"""用户管理 API - 仅管理员可访问"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.services.audit_logger import get_audit_logger
from backend.services.user_storage import get_user_storage
from backend.utils.auth import get_current_admin_user, hash_password

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["用户管理"])


# ===== Pydantic 模型 =====


class UserCreateRequest(BaseModel):
    """创建用户请求（管理员添加用户，无需密码，发送激活邮件）"""

    username: str = Field(..., min_length=3, max_length=255, description="用户名（邮箱地址）")
    email: str | None = Field(None, max_length=255, description="邮箱地址")
    full_name: str | None = Field(None, max_length=100, description="真实姓名")
    role: str = Field(default="user", description="角色（admin/user）")

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v):
        # 允许邮箱格式作为用户名
        if "@" in v:
            # 简单的邮箱格式验证
            if not v.count("@") == 1 or "." not in v.split("@")[1]:
                raise ValueError("邮箱格式不正确")
            return v
        # 普通用户名只允许字母、数字、下划线和连字符
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("用户名只能包含字母、数字、下划线、连字符，或使用邮箱格式")
        return v

        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含至少一个数字")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ["admin", "user"]:
            raise ValueError("角色必须是 admin 或 user")
        return v


class UserUpdateRequest(BaseModel):
    """更新用户请求"""

    full_name: str | None = Field(None, max_length=100)
    role: str | None = None
    is_active: bool | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v is not None and v not in ["admin", "user"]:
            raise ValueError("角色必须是 admin 或 user")
        return v


class PasswordChangeRequest(BaseModel):
    """修改密码请求"""

    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("密码长度至少为8位")
        if not any(c.isupper() for c in v):
            raise ValueError("密码必须包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码必须包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含至少一个数字")
        return v


class UserAccountPermissionRequest(BaseModel):
    """账号授权请求"""

    account_ids: list[str] = Field(..., description="账号ID列表")


# ===== API 端点 =====


@router.get("/", response_model=list[dict])
async def get_users(current_user: dict = Depends(get_current_admin_user)):
    """
    获取组织内所有用户列表

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    users = user_storage.get_users_by_org(current_user["org_id"])

    # 移除敏感信息
    return [{k: v for k, v in user.items() if k != "password_hash"} for user in users]


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest, current_user: dict = Depends(get_current_admin_user)
):
    """
    创建新用户（发送激活邮件）

    **权限：** 仅管理员
    **说明：**
    - 新用户将属于当前管理员所在的组织
    - 不需要提供密码，系统将发送激活邮件
    - 用户通过激活链接自行设置密码
    """

    from backend.database import get_db
    from backend.services.email_verification_service import get_email_verification_service

    user_storage = get_user_storage()
    db = next(get_db())
    verification_service = get_email_verification_service(db)

    try:
        # 使用username作为email（username已经验证为邮箱格式）
        email = request.username
        if request.email and request.email != email:
            # 如果提供了email字段且与username不同，使用email字段
            email = request.email

        # 1. 创建用户（临时密码，is_active=False）
        new_user = user_storage.create_user(
            org_id=current_user["org_id"],
            username=email,
            email=email,
            password_hash=hash_password("temporary_placeholder_password"),  # 临时占位密码
            full_name=request.full_name,
            role=request.role,
        )

        # 2. 立即将用户设置为未激活状态
        user_storage.update_user(new_user["id"], is_active=False)

        # 3. 发送激活邮件
        activation_result = await verification_service.send_activation_email(
            user_id=new_user["id"], email=email, full_name=request.full_name
        )

        if not activation_result["success"]:
            # 如果发送失败，删除创建的用户
            user_storage.delete_user(new_user["id"])
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"发送激活邮件失败: {activation_result['message']}",
            )

        logger.info("- user_id: %s, email: %s", new_user['id'], email)

        # 记录审计日志
        audit_logger = get_audit_logger()
        audit_logger.log_user_create(
            creator_id=current_user["id"],
            org_id=current_user["org_id"],
            new_user_id=new_user["id"],
            username=email,
        )

        # 移除敏感信息并返回
        return {
            **{k: v for k, v in new_user.items() if k != "password_hash"},
            "activation_email_sent": True,
            "message": "用户创建成功，激活邮件已发送",
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("❌ 创建用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"创建用户失败: {str(e)}"
        )
    finally:
        db.close()


@router.get("/{user_id}", response_model=dict)
async def get_user(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """
    获取用户详情

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 确保用户属于同一组织
    if user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问其他组织的用户")

    # 移除敏感信息
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.put("/{user_id}", response_model=dict)
async def update_user(
    user_id: str, request: UserUpdateRequest, current_user: dict = Depends(get_current_admin_user)
):
    """
    更新用户信息

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 确保用户属于同一组织
    if user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权修改其他组织的用户")

    # 更新用户
    updates = request.model_dump(exclude_unset=True)
    updated_user = user_storage.update_user(user_id, **updates)

    # 移除敏感信息
    return {k: v for k, v in updated_user.items() if k != "password_hash"}


@router.put("/{user_id}/password")
async def change_user_password(
    user_id: str,
    request: PasswordChangeRequest,
    current_user: dict = Depends(get_current_admin_user),
):
    """
    修改用户密码（管理员）

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 确保用户属于同一组织
    if user["org_id"] != current_user["org_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权修改其他组织的用户密码"
        )

    # 更新密码
    user_storage.update_password(user_id, hash_password(request.new_password))

    return {"message": "密码修改成功"}


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """
    删除用户

    **权限：** 仅管理员
    **说明：** 级联删除用户的所有云账号授权
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 确保用户属于同一组织
    if user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除其他组织的用户")

    # 不允许删除自己
    if user_id == current_user["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能删除自己")

    # 删除用户
    user_storage.delete_user(user_id)

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log_user_delete(
        deleter_id=current_user["id"],
        org_id=current_user["org_id"],
        deleted_user_id=user_id,
        username=user["username"],
    )

    return {"message": "用户删除成功"}


# ===== 云账号授权管理 =====


@router.get("/{user_id}/aws-accounts", response_model=list[str])
async def get_user_aws_accounts(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """
    获取用户的 AWS 账号授权列表

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user or user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    return user_storage.get_user_aws_accounts(user_id)


@router.post("/{user_id}/aws-accounts")
async def grant_aws_accounts(
    user_id: str,
    request: UserAccountPermissionRequest,
    current_user: dict = Depends(get_current_admin_user),
):
    """
    授权 AWS 账号给用户

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user or user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 批量授权
    audit_logger = get_audit_logger()
    for account_id in request.account_ids:
        user_storage.grant_aws_account(user_id, account_id, current_user["id"])

        # 记录审计日志
        audit_logger.log_permission_grant(
            user_id=current_user["id"],
            org_id=current_user["org_id"],
            target_user_id=user_id,
            account_id=account_id,
            account_type="aws",
        )

    return {
        "message": f"成功授权 {len(request.account_ids)} 个AWS账号",
        "account_ids": request.account_ids,
    }


@router.delete("/{user_id}/aws-accounts/{account_id}")
async def revoke_aws_account(
    user_id: str, account_id: str, current_user: dict = Depends(get_current_admin_user)
):
    """
    撤销 AWS 账号授权

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user or user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    user_storage.revoke_aws_account(user_id, account_id)

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log_permission_revoke(
        user_id=current_user["id"],
        org_id=current_user["org_id"],
        target_user_id=user_id,
        account_id=account_id,
        account_type="aws",
    )

    return {"message": "授权撤销成功"}


@router.get("/{user_id}/gcp-accounts", response_model=list[str])
async def get_user_gcp_accounts(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """
    获取用户的 GCP 账号授权列表

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user or user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    return user_storage.get_user_gcp_accounts(user_id)


@router.post("/{user_id}/gcp-accounts")
async def grant_gcp_accounts(
    user_id: str,
    request: UserAccountPermissionRequest,
    current_user: dict = Depends(get_current_admin_user),
):
    """
    授权 GCP 账号给用户

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user or user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 批量授权
    audit_logger = get_audit_logger()
    for account_id in request.account_ids:
        user_storage.grant_gcp_account(user_id, account_id, current_user["id"])

        # 记录审计日志
        audit_logger.log_permission_grant(
            user_id=current_user["id"],
            org_id=current_user["org_id"],
            target_user_id=user_id,
            account_id=account_id,
            account_type="gcp",
        )

    return {
        "message": f"成功授权 {len(request.account_ids)} 个GCP账号",
        "account_ids": request.account_ids,
    }


@router.delete("/{user_id}/gcp-accounts/{account_id}")
async def revoke_gcp_account(
    user_id: str, account_id: str, current_user: dict = Depends(get_current_admin_user)
):
    """
    撤销 GCP 账号授权

    **权限：** 仅管理员
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_id(user_id)

    if not user or user["org_id"] != current_user["org_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    user_storage.revoke_gcp_account(user_id, account_id)

    # 记录审计日志
    audit_logger = get_audit_logger()
    audit_logger.log_permission_revoke(
        user_id=current_user["id"],
        org_id=current_user["org_id"],
        target_user_id=user_id,
        account_id=account_id,
        account_type="gcp",
    )

    return {"message": "授权撤销成功"}
