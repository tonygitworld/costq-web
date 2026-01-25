"""邮箱验证服务

提供验证码和激活Token的生成、验证、邮件发送等功能
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from backend.models.email_verification import EmailVerificationCode, VerificationPurpose
from backend.models.user_activation import UserActivationToken
from backend.services.email_service import get_email_service

import logging

logger = logging.getLogger(__name__)


class EmailVerificationService:
    """邮箱验证服务"""

    def __init__(self, db: Session):
        self.db = db
        self.email_service = get_email_service()

    # ========== 验证码相关 ==========

    @staticmethod
    def generate_verification_code() -> str:
        """生成6位随机验证码"""
        return str(secrets.randbelow(1000000)).zfill(6)

    async def send_verification_code(
        self, email: str, purpose: str = VerificationPurpose.REGISTER
    ) -> dict[str, Any]:
        """
        发送验证码到邮箱

        Args:
            email: 邮箱地址
            purpose: 用途（register, reset_password）

        Returns:
            Dict[str, Any]: 发送结果
            {
                'success': True/False,
                'message': '提示信息',
                'expires_in': 300,  # 过期时间（秒）
                'can_resend_at': 1640000000  # 可以重新发送的时间戳
            }
        """
        # 1. 检查速率限制（同一邮箱1分钟内只能发送1次）
        one_minute_ago = datetime.now(UTC) - timedelta(minutes=1)
        recent_code = (
            self.db.query(EmailVerificationCode)
            .filter(
                and_(
                    EmailVerificationCode.email == email,
                    EmailVerificationCode.purpose == purpose,
                    EmailVerificationCode.created_at > one_minute_ago,
                )
            )
            .first()
        )

        if recent_code:
            can_resend_at = int((recent_code.created_at + timedelta(minutes=1)).timestamp())
            return {
                "success": False,
                "message": "发送过于频繁，请稍后再试",
                "error_code": "RATE_LIMIT_EXCEEDED",
                "can_resend_at": can_resend_at,
            }

        # 2. 生成验证码
        code = self.generate_verification_code()
        # 使用带时区的datetime，与数据库字段类型一致
        expires_at = datetime.now(UTC) + timedelta(minutes=5)  # 5分钟过期

        # 3. 保存到数据库
        verification_code = EmailVerificationCode(
            id=str(uuid.uuid4()),
            email=email,
            code=code,
            purpose=purpose,
            attempts=0,
            expires_at=expires_at,
        )
        self.db.add(verification_code)
        self.db.commit()

        logger.info("- email: %s, code: %s, expires_at: %s", email, code, expires_at)

        # 4. 发送邮件
        subject = "CostQ - 邮箱验证码"
        html_body = self._build_verification_email_html(code, email)
        text_body = self._build_verification_email_text(code)

        email_result = await self.email_service.send_html_email(
            to_emails=[email], subject=subject, html_body=html_body, text_body=text_body
        )

        if not email_result.get("success"):
            logger.error("❌ 验证码邮件发送失败: {email_result.get('error')}")
            return {
                "success": False,
                "message": "邮件发送失败，请稍后重试",
                "error": email_result.get("error"),
            }

        return {
            "success": True,
            "message": "验证码已发送到您的邮箱",
            "expires_in": 300,  # 5分钟
            "can_resend_at": int((datetime.now(UTC) + timedelta(minutes=1)).timestamp()),
        }

    def verify_code(
        self, email: str, code: str, purpose: str = VerificationPurpose.REGISTER
    ) -> dict[str, Any]:
        """
        验证验证码

        Args:
            email: 邮箱地址
            code: 验证码
            purpose: 用途

        Returns:
            Dict[str, Any]: 验证结果
            {
                'success': True/False,
                'message': '提示信息',
                'remaining_attempts': 3  # 剩余尝试次数（失败时返回）
            }
        """
        # 1. 查找验证码记录
        verification = (
            self.db.query(EmailVerificationCode)
            .filter(
                and_(
                    EmailVerificationCode.email == email,
                    EmailVerificationCode.purpose == purpose,
                    EmailVerificationCode.verified_at.is_(None),  # 未验证
                )
            )
            .order_by(EmailVerificationCode.created_at.desc())
            .first()
        )

        if not verification:
            return {
                "success": False,
                "message": "验证码不存在或已过期",
                "error_code": "CODE_NOT_FOUND",
            }

        # 2. 检查是否过期
        if verification.is_expired():
            return {
                "success": False,
                "message": "验证码已过期，请重新获取",
                "error_code": "CODE_EXPIRED",
            }

        # 3. 检查是否已验证
        if verification.is_verified():
            return {"success": False, "message": "验证码已使用", "error_code": "CODE_USED"}

        # 4. 检查尝试次数
        if verification.attempts >= 5:
            return {
                "success": False,
                "message": "验证码尝试次数过多，请重新获取",
                "error_code": "MAX_ATTEMPTS_EXCEEDED",
            }

        # 5. 验证码匹配
        if verification.code != code:
            # 尝试次数+1
            verification.attempts += 1
            self.db.commit()

            remaining = 5 - verification.attempts
            return {
                "success": False,
                "message": f"验证码错误，还剩 {remaining} 次尝试机会",
                "error_code": "CODE_MISMATCH",
                "remaining_attempts": remaining,
            }

        # 6. 验证成功
        verification.verified_at = datetime.now(UTC)
        self.db.commit()

        logger.info("- email: %s", email)

        return {"success": True, "message": "验证码验证成功"}

    # ========== 激活Token相关 ==========

    @staticmethod
    def generate_activation_token() -> str:
        """生成激活Token（128位随机字符串）"""
        return secrets.token_urlsafe(96)  # 96字节 = 128字符（base64）

    async def send_activation_email(
        self, user_id: str, email: str, full_name: str | None = None
    ) -> dict[str, Any]:
        """
        发送激活邮件

        Args:
            user_id: 用户ID
            email: 邮箱地址
            full_name: 用户姓名（可选）

        Returns:
            Dict[str, Any]: 发送结果
            {
                'success': True/False,
                'message': '提示信息',
                'token': 'activation-token',  # 成功时返回
                'expires_at': '2024-01-02T00:00:00',  # 过期时间
                'activation_url': 'http://localhost:5173/activate/xxx'
            }
        """
        # 1. 作废该用户的旧Token
        self.db.query(UserActivationToken).filter(
            and_(UserActivationToken.user_id == user_id, UserActivationToken.used_at.is_(None))
        ).update({"used_at": datetime.now(UTC)})
        self.db.commit()

        # 2. 生成新Token
        token = self.generate_activation_token()
        expires_at = datetime.now(UTC) + timedelta(hours=24)  # 24小时过期

        # 3. 保存到数据库
        activation_token = UserActivationToken(
            id=str(uuid.uuid4()), user_id=user_id, token=token, email=email, expires_at=expires_at
        )
        self.db.add(activation_token)
        self.db.commit()

        logger.info(
            f"📝 生成激活Token - user_id: {user_id}, email: {email}, expires_at: {expires_at}"
        )

        # 4. 构建激活链接（从配置读取前端域名）
        from backend.config.settings import get_settings

        settings = get_settings()
        activation_url = f"{settings.FRONTEND_URL}/activate/{token}"

        # 5. 发送邮件
        subject = "CostQ - 激活您的账号"
        html_body = self._build_activation_email_html(email, activation_url, full_name)
        text_body = self._build_activation_email_text(email, activation_url, full_name)

        email_result = await self.email_service.send_html_email(
            to_emails=[email], subject=subject, html_body=html_body, text_body=text_body
        )

        if not email_result.get("success"):
            logger.error("❌ 激活邮件发送失败: {email_result.get('error')}")
            return {
                "success": False,
                "message": "激活邮件发送失败，请稍后重试",
                "error": email_result.get("error"),
            }

        return {
            "success": True,
            "message": "激活邮件已发送",
            "token": token,
            "expires_at": expires_at.isoformat(),
            "activation_url": activation_url,
        }

    def verify_activation_token(self, token: str) -> dict[str, Any]:
        """
        验证激活Token

        Args:
            token: 激活Token

        Returns:
            Dict[str, Any]: 验证结果
            {
                'success': True/False,
                'message': '提示信息',
                'user_id': 'user-uuid',  # 成功时返回
                'email': 'user@example.com'  # 成功时返回
            }
        """
        # 1. 查找Token记录
        activation = (
            self.db.query(UserActivationToken).filter(UserActivationToken.token == token).first()
        )

        if not activation:
            return {"success": False, "message": "激活链接无效", "error_code": "TOKEN_NOT_FOUND"}

        # 2. 检查是否过期
        if activation.is_expired():
            return {
                "success": False,
                "message": "激活链接已过期，请联系管理员重新发送",
                "error_code": "TOKEN_EXPIRED",
            }

        # 3. 检查是否已使用
        if activation.is_used():
            return {"success": False, "message": "激活链接已使用", "error_code": "TOKEN_USED"}

        # 4. Token有效
        return {
            "success": True,
            "message": "Token验证成功",
            "user_id": activation.user_id,
            "email": activation.email,
            "activation_id": activation.id,
        }

    def mark_activation_used(self, activation_id: str):
        """标记激活Token为已使用"""
        activation = (
            self.db.query(UserActivationToken)
            .filter(UserActivationToken.id == activation_id)
            .first()
        )

        if activation:
            activation.used_at = datetime.now(UTC)
            self.db.commit()
            logger.info("Token- activation_id: %s", activation_id)

    # ========== 邮件模板 ==========

    def _build_verification_email_html(self, code: str, email: str) -> str:
        """构建验证码邮件HTML"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .code-box {{ background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; text-align: center; }}
        .code {{ font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; }}
        .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
        .warning {{ color: #ff6b6b; margin-top: 15px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✉️ 邮箱验证</h1>
        </div>
        <div class="content">
            <p>您好，</p>
            <p>您正在注册 <strong>CostQ</strong> 账号，请使用以下验证码完成注册：</p>

            <div class="code-box">
                <div class="code">{code}</div>
                <p style="margin-top: 10px; color: #666;">验证码有效期：<strong>5分钟</strong></p>
            </div>

            <p>如果这不是您的操作，请忽略此邮件。</p>

            <p class="warning">⚠️ 请勿将验证码告诉他人，CostQ 工作人员不会索要您的验证码。</p>
        </div>
        <div class="footer">
            <p>此邮件由 CostQ 自动发送，请勿回复。</p>
            <p>© 2024 CostQ. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

    def _build_verification_email_text(self, code: str) -> str:
        """构建验证码邮件纯文本"""
        return f"""
CostQ - 邮箱验证

您好，

您正在注册 CostQ 账号，请使用以下验证码完成注册：

验证码：{code}

验证码有效期：5分钟

如果这不是您的操作，请忽略此邮件。

⚠️ 请勿将验证码告诉他人，CostQ 工作人员不会索要您的验证码。

---
此邮件由 CostQ 自动发送，请勿回复。
© 2024 CostQ. All rights reserved.
"""

    def _build_activation_email_html(
        self, email: str, activation_url: str, full_name: str | None = None
    ) -> str:
        """构建激活邮件HTML"""
        greeting = f"您好 {full_name}，" if full_name else "您好，"

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .button-box {{ text-align: center; margin: 30px 0; }}
        .button {{ display: inline-block; padding: 15px 40px; background-color: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }}
        .button:hover {{ background-color: #5568d3; }}
        .info-box {{ background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }}
        .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 欢迎加入 CostQ</h1>
        </div>
        <div class="content">
            <p>{greeting}</p>
            <p>管理员已为您创建了 <strong>CostQ</strong> 账号，邮箱地址为：<strong>{email}</strong></p>
            <p>请点击下方按钮激活您的账号并设置密码：</p>

            <div class="button-box">
                <a href="{activation_url}" class="button">激活账号</a>
            </div>

            <div class="info-box">
                <p><strong>📋 重要信息：</strong></p>
                <ul>
                    <li>激活链接有效期：<strong>24小时</strong></li>
                    <li>链接只能使用一次</li>
                    <li>激活后请妥善保管您的密码</li>
                </ul>
            </div>

            <p>如果按钮无法点击，请复制以下链接到浏览器打开：</p>
            <p style="word-break: break-all; color: #667eea;">{activation_url}</p>

            <p style="margin-top: 30px; color: #666;">如有任何问题，请联系管理员或客服。</p>
        </div>
        <div class="footer">
            <p>此邮件由 CostQ 自动发送，请勿回复。</p>
            <p>© 2024 CostQ. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

    def _build_activation_email_text(
        self, email: str, activation_url: str, full_name: str | None = None
    ) -> str:
        """构建激活邮件纯文本"""
        greeting = f"您好 {full_name}，" if full_name else "您好，"

        return f"""
CostQ - 激活您的账号

{greeting}

管理员已为您创建了 CostQ 账号，邮箱地址为：{email}

请点击以下链接激活您的账号并设置密码：

{activation_url}

📋 重要信息：
- 激活链接有效期：24小时
- 链接只能使用一次
- 激活后请妥善保管您的密码

如有任何问题，请联系管理员或客服。

---
此邮件由 CostQ 自动发送，请勿回复。
© 2024 CostQ. All rights reserved.
"""


def get_email_verification_service(db: Session) -> EmailVerificationService:
    """获取邮箱验证服务实例"""
    return EmailVerificationService(db)
