"""认证工具 - JWT生成和验证"""

from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from backend.config.settings import settings
from backend.services.user_storage import get_user_storage

import logging

logger = logging.getLogger(__name__)

# JWT 配置（从统一配置中心获取）
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.FRONTEND_ACCESS_TOKEN_EXPIRE_MINUTES

# HTTP Bearer 认证
security = HTTPBearer()


def hash_password(password: str) -> str:
    """
    加密密码

    使用bcrypt算法，成本因子为12（安全性与性能的平衡）
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码

    Args:
        plain_password: 明文密码
        hashed_password: 哈希后的密码

    Returns:
        True if 密码匹配, False otherwise
    """
    try:
        password_bytes = plain_password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    创建 JWT Access Token

    Args:
        data: 要编码的数据（通常包含 sub, username, role）
        expires_delta: 过期时间增量（默认使用配置的 ACCESS_TOKEN_EXPIRE_MINUTES）

    Returns:
        编码后的 JWT access token
    """

    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        # 使用配置的过期时间（默认 24 小时）
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "type": "access",  # Token类型标识
        }
    )

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    # 记录 Token 创建和过期时间
    username = data.get("username", "unknown")
    ttl = (expire - now).total_seconds() / 3600  # 小时
    logger.info(
        "Token已创建 - User: %s, 过期时间: %s UTC (%.1f小时后)",
        username,
        expire.strftime("%Y-%m-%d %H:%M:%S"),
        ttl,
    )

    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    创建 JWT Refresh Token（长期）

    Args:
        data: 要编码的数据（通常只包含 sub）
        expires_delta: 过期时间增量（默认使用配置的 FRONTEND_REFRESH_TOKEN_EXPIRE_MINUTES）

    Returns:
        编码后的 JWT refresh token
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        # 使用配置的过期时间（统一单位为分钟）
        # 生产环境：7天（10080分钟），开发环境：1小时（60分钟）
        refresh_token_expire_minutes = settings.FRONTEND_REFRESH_TOKEN_EXPIRE_MINUTES
        expire = now + timedelta(minutes=refresh_token_expire_minutes)

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "type": "refresh",  # Token类型标识
        }
    )

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str, expected_type: str = "access") -> dict:
    """
    解码并验证 JWT Token

    Args:
        token: JWT token
        expected_type: 期望的Token类型（"access" 或 "refresh"）

    Returns:
        解码后的数据

    Raises:
        HTTPException: Token 无效、过期或类型不匹配
    """

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # ✅ 验证Token类型
        token_type = payload.get("type", "access")  # 兼容旧Token（默认access）
        if token_type != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token类型错误: 期望{expected_type}，实际{token_type}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload
    except JWTError as e:
        # 🆕 详细记录 Token 验证失败原因
        error_msg = str(e)

        # 解析常见错误
        if "Signature has expired" in error_msg:
            # 尝试解码过期Token以获取用户信息
            try:
                expired_payload = jwt.decode(
                    token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False}
                )
                username = expired_payload.get("username", "unknown")
                exp_time = datetime.fromtimestamp(expired_payload.get("exp", 0), tz=timezone.utc)
                now_utc = datetime.now(timezone.utc)
                logger.warning(
                    "Token已过期 - User: %s, 过期时间: %s UTC, 当前时间: %s UTC",
                    username,
                    exp_time.strftime("%Y-%m-%d %H:%M:%S"),
                    now_utc.strftime("%Y-%m-%d %H:%M:%S"),
                )
            except Exception:
                logger.warning("Token已过期（无法解析用户信息）")
        elif "Invalid signature" in error_msg:
            logger.warning("Token签名无效")
        else:
            logger.warning("Token验证失败: %s", error_msg)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"无效的认证凭证: {error_msg}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    获取当前登录用户（依赖注入）

    Args:
        credentials: HTTP Bearer 凭证

    Returns:
        当前用户字典

    Raises:
        HTTPException: 认证失败
    """

    try:
        token = credentials.credentials
        payload = decode_access_token(token)

        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("Token中没有user_id")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭证",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 从数据库获取用户
        user_storage = get_user_storage()
        user = user_storage.get_user_by_id(user_id)
        if user is None:
            logger.warning("用户不存在 - ID: %s", user_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.get("is_active"):
            logger.warning("用户已被禁用 - User: %s", user.get("username"))
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="用户已被禁用")

        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error("认证失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"认证失败: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    获取当前管理员用户（依赖注入）

    Args:
        current_user: 当前用户字典

    Returns:
        当前管理员用户字典

    Raises:
        HTTPException: 用户不是管理员
    """

    logger.debug(
        "权限检查 - User: %s, Role: %s", current_user.get("username"), current_user.get("role")
    )

    if current_user.get("role") != "admin":
        logger.warning(
            "权限不足 - User: %s, Role: %s", current_user.get("username"), current_user.get("role")
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


def authenticate_user(username: str, password: str) -> dict | None:
    """
    验证用户名和密码

    Args:
        username: 用户名
        password: 密码

    Returns:
        用户字典（验证成功）或 None（验证失败）
    """
    user_storage = get_user_storage()
    user = user_storage.get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user.get("password_hash")):
        return None
    return user
