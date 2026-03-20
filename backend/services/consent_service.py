"""用户同意记录服务"""

from sqlalchemy.orm import Session

from backend.models.user_consent import ConsentType, UserConsent

PRIVACY_POLICY_VERSION = "1.0"
TERMS_OF_SERVICE_VERSION = "1.0"


class ConsentService:
    """用户同意记录服务"""

    def __init__(self, db: Session):
        self.db = db

    def record_consents(
        self,
        user_id: str,
        org_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> list[UserConsent]:
        """写入注册时的协议同意记录。"""

        records = [
            UserConsent(
                user_id=user_id,
                org_id=org_id,
                consent_type=ConsentType.PRIVACY_POLICY.value,
                consent_version=PRIVACY_POLICY_VERSION,
                ip_address=ip_address,
                user_agent=user_agent,
            ),
            UserConsent(
                user_id=user_id,
                org_id=org_id,
                consent_type=ConsentType.TERMS_OF_SERVICE.value,
                consent_version=TERMS_OF_SERVICE_VERSION,
                ip_address=ip_address,
                user_agent=user_agent,
            ),
        ]

        self.db.add_all(records)
        self.db.flush()

        return records
