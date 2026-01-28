"""认证相关 API - 多租户架构"""

import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text

from backend.config.settings import get_settings
from backend.services.audit_logger import get_audit_logger
from backend.services.user_storage import get_user_storage
from backend.utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

import logging

logger = logging.getLogger(__name__)

settings = get_settings()

router = APIRouter(prefix="/api/auth", tags=["认证"])

# 创建速率限制器实例
limiter = Limiter(key_func=get_remote_address)


# ===== Pydantic 模型 =====


class RegisterRequest(BaseModel):
    """注册请求"""

    model_config = {"populate_by_name": True}

    organization_name: str = Field(
        ..., min_length=2, max_length=100, description="组织名称", alias="org_name"
    )
    email: str = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=8, description="密码")
    full_name: str | None = Field(None, max_length=100, description="真实姓名")
    verification_code: str = Field(
        ..., min_length=6, max_length=6, description="邮箱验证码"
    )  # ✅ 新增

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        """验证邮箱格式"""
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()  # 转为小写

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        """验证密码强度"""
        if len(v) < 8:
            raise ValueError("密码长度至少为8位")
        if not any(c.isupper() for c in v):
            raise ValueError("密码必须包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码必须包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含至少一个数字")
        return v

    @field_validator("verification_code")
    @classmethod
    def verification_code_valid(cls, v):
        """验证验证码格式"""
        if not v.isdigit():
            raise ValueError("验证码必须是6位数字")
        return v


class LoginRequest(BaseModel):
    """登录请求"""

    email: str  # 改为email
    password: str


class TokenResponse(BaseModel):
    """Token 响应"""

    access_token: str
    refresh_token: str  # ✅ 新增：刷新Token
    token_type: str = "bearer"
    expires_in: int  # Access Token过期时间（秒），从配置读取
    user: dict
    organization: dict


class RefreshTokenRequest(BaseModel):
    """刷新Token请求"""

    refresh_token: str = Field(..., description="刷新Token")


class RefreshTokenResponse(BaseModel):
    """刷新Token响应"""

    access_token: str
    refresh_token: str  # 返回新的refresh token（可选，实现refresh token轮换）
    token_type: str = "bearer"
    expires_in: int  # Access Token过期时间（秒），从配置读取


class UserResponse(BaseModel):
    """用户信息响应"""

    id: str
    org_id: str
    username: str
    email: str  # ✅ 新增：邮箱字段（用于超级管理员判断）
    full_name: str | None = None
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None = None


# ===== API 端点 =====


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")  # 速率限制：每小时最多3次注册（防止滥用）
async def register(register_request: RegisterRequest, request: Request):
    """
    用户注册（多租户架构）+ 邮箱验证

    **注册流程：**
    1. 验证邮箱验证码
    2. 检查邮箱是否已被使用
    3. 创建新组织（Organization）
    4. 创建首个用户（自动成为该组织的管理员）
    5. 标记邮箱为已验证

    **多租户模式：**
    - 每个注册都会创建一个新的组织
    - 注册用户自动成为该组织的管理员
    - 组织间数据完全隔离

    **要求：**
    - 组织名称：2-100字符
    - 邮箱：有效的邮箱地址（全局唯一）
    - 密码：至少8位，包含大小写字母和数字
    - 验证码：6位数字，有效期5分钟
    """

    from backend.database import get_db
    from backend.services.email_verification_service import get_email_verification_service

    logger.info(
        f"📝 收到注册请求 - 组织名称: {register_request.organization_name}, 邮箱: {register_request.email}"
    )

    user_storage = get_user_storage()
    db = next(get_db())
    verification_service = get_email_verification_service(db)

    try:
        # ✅ 1. 验证邮箱验证码
        logger.info(
            f"🔍 验证邮箱验证码 - email: {register_request.email}, code: {register_request.verification_code}"
        )
        code_result = verification_service.verify_code(
            email=register_request.email, code=register_request.verification_code
        )
        logger.info(": %s", code_result)

        if not code_result["success"]:
            logger.warning(": %s", code_result['message'])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=code_result["message"]
            )

        # ✅ 2. 检查邮箱是否已被使用（跨所有组织）
        logger.info(": %s", register_request.email)
        existing_users = user_storage.get_all_users()
        if any(u["username"].lower() == register_request.email.lower() for u in existing_users):
            logger.warning(": %s", register_request.email)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该邮箱已被使用")

        # 3. 创建新组织（默认禁用，等待管理员审核）
        organization = user_storage.create_organization(
            name=register_request.organization_name,
            description=f"由 {register_request.email} 创建的组织",
            is_active=False,  # ✅ 直接在创建时设置为禁用状态
        )
        logger.info("- org_id: %s", organization['id'])

        # 4. 创建首个用户（组织管理员，使用邮箱作为用户名）
        try:
            new_user = user_storage.create_user(
                org_id=organization["id"],
                username=register_request.email,  # 使用邮箱作为用户名
                email=register_request.email,  # 添加 email 字段
                password_hash=hash_password(register_request.password),
                full_name=register_request.full_name,
                role="admin",  # 首个用户自动成为组织管理员
            )
        except ValueError as e:
            # 如果用户创建失败，理论上不应该发生（因为是首个用户）
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        # ✅ 5. 标记邮箱为已验证
        db.execute(
            text("""
            UPDATE users
            SET email_verified_at = :now
            WHERE id = :user_id
        """),
            {"now": datetime.now(UTC), "user_id": new_user["id"]},
        )
        db.commit()

        # 移除敏感信息
        user_data = {k: v for k, v in new_user.items() if k != "password_hash"}

        # ✅ 检查租户是否激活
        if not organization.get("is_active", False):
            # 租户未激活：不返回 token，返回等待审核消息
            logger.info("- user_id: %s, email: %s", new_user['id'], register_request.email)

            response_data = {
                "message": "注册成功，账号正在审核中，审核通过后即可登录使用",
                "requires_activation": True,
                "user": user_data,
                "organization": organization,
            }

            logger.debug(": %s", response_data)
            return response_data

        # 租户已激活：生成并返回 Token
        logger.info("- user_id: %s, email: %s", new_user['id'], register_request.email)

        access_token = create_access_token(
            data={
                "sub": new_user["id"],
                "org_id": new_user["org_id"],
                "username": new_user["username"],
                "role": new_user["role"],
            }
        )

        refresh_token = create_refresh_token(data={"sub": new_user["id"]})

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.FRONTEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": user_data,
            "organization": organization,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("❌ 注册失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"注册失败: {str(e)}"
        )
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")  # 速率限制：每分钟最多5次登录尝试
async def login(login_request: LoginRequest, request: Request):
    """
    用户登录（多租户架构）

    **速率限制**: 5次/分钟 (防止暴力破解)

    **登录流程：**
    1. 使用邮箱查找用户
    2. 验证密码
    3. 返回 Token（包含组织信息）
    """
    user_storage = get_user_storage()
    audit_logger = get_audit_logger()

    # 获取请求信息（用于日志记录）
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # 查找用户（遍历所有用户，查找邮箱匹配）
    user = None
    for u in user_storage.get_all_users():
        if u["username"].lower() == login_request.email.lower():
            if verify_password(login_request.password, u.get("password_hash", "")):
                user = u
                break

    if not user:
        # ✅ 记录失败的登录尝试
        logger.warning(
            f"⚠️ 登录失败 - 邮箱: {login_request.email}, "
            f"IP: {ip_address or 'unknown'}, 原因: 邮箱或密码错误"
        )
        audit_logger.log_login_failed(
            email=login_request.email,
            reason="invalid_credentials",
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # ✅ 返回结构化错误（向后兼容：detail 可以是字符串或字典）
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "邮箱或密码错误", "error_code": "INVALID_CREDENTIALS"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active"):
        # ✅ 记录账号被禁用的登录尝试
        logger.warning(
            f"⚠️ 登录失败 - 邮箱: {login_request.email}, "
            f"IP: {ip_address or 'unknown'}, 原因: 账号已被禁用"
        )
        audit_logger.log_login_failed(
            email=login_request.email,
            reason="account_disabled",
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # ✅ 返回结构化错误
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "账号已被禁用，请联系管理员", "error_code": "ACCOUNT_DISABLED"},
        )

    # 获取组织信息
    organization = user_storage.get_organization_by_id(user["org_id"])
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="组织信息不存在"
        )

    # ✅ 检查租户是否被禁用（新增）
    # 白名单策略：默认False，明确激活才允许访问
    if not organization.get("is_active", False):
        logger.warning(
            f"⚠️ 登录失败 - 邮箱: {login_request.email}, "
            f"原因: 租户未激活 (org_id: {user['org_id']})"
        )
        audit_logger.log_login_failed(
            email=login_request.email,
            reason="tenant_inactive",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "你的账号正在审核中，审核通过后即可登录。如有疑问请联系管理员。",
                "error_code": "TENANT_INACTIVE"
            },
        )

    # 更新最后登录时间
    try:
        user_storage.update_last_login(user["id"])
    except Exception as e:
        # 如果数据库没有 last_login_at 字段，记录警告但不影响登录
        logger.warning(": %s", e)

    # ✅ 记录审计日志（登录成功）
    audit_logger.log_login(user["id"], user["org_id"], ip_address)

    # ✅ 生成 Access Token（15分钟）和 Refresh Token（7天）
    access_token = create_access_token(
        data={
            "sub": user["id"],
            "org_id": user["org_id"],
            "username": user["username"],
            "role": user["role"],
        }
    )

    refresh_token = create_refresh_token(
        data={
            "sub": user["id"]  # Refresh Token只需包含user_id
        }
    )

    # 移除敏感信息
    user_data = {k: v for k, v in user.items() if k != "password_hash"}

    # ✅ 已删除预热逻辑（详见重构文档）
    # MCP 客户端将在首次查询时按需加载

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.FRONTEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 24小时 = 86400秒
        "user": user_data,
        "organization": organization,
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    获取当前登录用户信息

    - 需要有效的 Token
    - 返回用户和组织信息
    """
    # 移除敏感信息
    user_data = {k: v for k, v in current_user.items() if k != "password_hash"}
    return user_data


@router.get("/organization")
async def get_current_organization(current_user: dict = Depends(get_current_user)):
    """
    获取当前用户所属的组织信息
    """
    user_storage = get_user_storage()
    organization = user_storage.get_organization_by_id(current_user["org_id"])

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="组织不存在")

    return organization


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("10/minute")  # 速率限制：每分钟最多10次刷新
async def refresh_access_token(refresh_request: RefreshTokenRequest, request: Request):
    """
    刷新 Access Token

    **功能**:
    - 使用 Refresh Token 获取新的 Access Token
    - 同时返回新的 Refresh Token（Token轮换）
    - Refresh Token 过期时间为7天

    **速率限制**: 10次/分钟

    **使用场景**:
    - Access Token 过期（15分钟）
    - 前端应在 Access Token 即将过期时主动刷新
    """
    user_storage = get_user_storage()

    try:
        # ✅ 解码并验证 Refresh Token
        payload = decode_access_token(refresh_request.refresh_token, expected_type="refresh")
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的 Refresh Token"
            )

        # 获取用户信息
        user = user_storage.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")

        if not user.get("is_active"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="用户已被禁用")

        # ✅ 生成新的 Access Token
        new_access_token = create_access_token(
            data={
                "sub": user["id"],
                "org_id": user["org_id"],
                "username": user["username"],
                "role": user["role"],
            }
        )

        # ✅ 生成新的 Refresh Token（Token轮换，增强安全性）
        new_refresh_token = create_refresh_token(data={"sub": user["id"]})

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": settings.FRONTEND_ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 24小时 = 86400秒
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token刷新失败: {str(e)}"
        )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    用户登出

    - JWT 是无状态的，前端需要删除 Token
    - 这个端点主要用于记录登出日志
    """
    return {
        "message": "登出成功",
        "username": current_user["username"],
        "organization": current_user["org_id"],
    }


# ===== 邮箱验证相关端点 =====


class SendVerificationCodeRequest(BaseModel):
    """发送验证码请求"""

    email: str = Field(..., description="邮箱地址")

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        """验证邮箱格式"""
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("邮箱格式不正确")
        return v.lower()


class ActivateAccountRequest(BaseModel):
    """激活账号请求"""

    token: str = Field(..., description="激活Token")
    password: str = Field(..., min_length=8, description="密码")

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        """验证密码强度"""
        if len(v) < 8:
            raise ValueError("密码长度至少为8位")
        if not any(c.isupper() for c in v):
            raise ValueError("密码必须包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码必须包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码必须包含至少一个数字")
        return v


class ResendActivationRequest(BaseModel):
    """重新发送激活邮件请求"""

    email: str = Field(..., description="邮箱地址")


@router.post("/send-verification-code")
@limiter.limit("10/hour")
async def send_verification_code(request_body: SendVerificationCodeRequest, request: Request):
    """发送注册验证码"""
    from backend.database import get_db
    from backend.services.email_verification_service import get_email_verification_service

    db = next(get_db())
    user_storage = get_user_storage()
    verification_service = get_email_verification_service(db)

    try:
        email = request_body.email

        # 检查邮箱是否已注册
        existing_users = user_storage.get_all_users()
        if any(u["username"].lower() == email.lower() for u in existing_users):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该邮箱已被注册")

        # 发送验证码
        result = await verification_service.send_verification_code(email)

        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS
                if result.get("error_code") == "RATE_LIMIT_EXCEEDED"
                else status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["message"],
            )

        return {
            "message": result["message"],
            "expires_in": result["expires_in"],
            "can_resend_at": result["can_resend_at"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("❌ 发送验证码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"发送验证码失败: {str(e)}"
        )
    finally:
        db.close()


@router.post("/activate", status_code=status.HTTP_200_OK)
async def activate_account(request_body: ActivateAccountRequest):
    """激活账号（设置密码）"""
    from backend.database import get_db
    from backend.services.email_verification_service import get_email_verification_service

    db = next(get_db())
    user_storage = get_user_storage()
    verification_service = get_email_verification_service(db)

    try:
        # 1. 验证Token
        token_result = verification_service.verify_activation_token(request_body.token)

        if not token_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=token_result["message"]
            )

        user_id = token_result["user_id"]
        email = token_result["email"]
        activation_id = token_result["activation_id"]

        # 2. 获取用户
        user = user_storage.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

        # 3. 更新用户（设置密码、激活账号、验证邮箱）
        user_storage.update_password(user_id, hash_password(request_body.password))
        user_storage.update_user(user_id, is_active=True)

        # 更新 email_verified_at（直接操作数据库）
        from sqlalchemy import text

        db.execute(
            text("""
            UPDATE users
            SET email_verified_at = :now
            WHERE id = :user_id
        """),
            {"now": datetime.now(UTC), "user_id": user_id},
        )
        db.commit()

        # 4. 标记Token为已使用
        verification_service.mark_activation_used(activation_id)

        logger.info("- user_id: %s, email: %s", user_id, email)

        return {"message": "账号激活成功，请登录", "email": email, "can_login": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("❌ 激活账号失败: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"激活账号失败: {str(e)}"
        )
    finally:
        db.close()


@router.post("/resend-activation")
@limiter.limit("5/hour")
async def resend_activation(request_body: ResendActivationRequest, request: Request):
    """重新发送激活邮件"""
    from backend.database import get_db
    from backend.services.email_verification_service import get_email_verification_service

    db = next(get_db())
    user_storage = get_user_storage()
    verification_service = get_email_verification_service(db)

    try:
        email = request_body.email

        # 查找用户
        all_users = user_storage.get_all_users()
        user = next((u for u in all_users if u["username"].lower() == email.lower()), None)

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

        # 检查用户状态
        if user.get("is_active") and user.get("email_verified_at"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="账号已激活")

        # 发送激活邮件
        result = await verification_service.send_activation_email(
            user_id=user["id"], email=email, full_name=user.get("full_name")
        )

        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result["message"]
            )

        return {"message": "激活邮件已重新发送", "expires_in": 86400}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("❌ 重新发送激活邮件失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重新发送激活邮件失败: {str(e)}",
        )
    finally:
        db.close()
