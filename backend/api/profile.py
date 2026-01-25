"""用户个人信息管理 API"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.services.user_storage import get_user_storage
from backend.utils.auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/profile", tags=["个人信息"])


class ChangePasswordRequest(BaseModel):
    """修改密码请求（用户自己修改需要旧密码）"""

    old_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., min_length=8, description="新密码")

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


@router.put("/change-password")
async def change_password(
    request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)
):
    """
    修改当前用户密码

    **权限：** 所有登录用户
    **说明：** 需要提供当前密码验证
    """
    user_storage = get_user_storage()

    # 验证旧密码
    if not verify_password(request.old_password, current_user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前密码不正确")

    # 更新密码
    user_storage.update_password(current_user["id"], hash_password(request.new_password))

    return {"message": "密码修改成功，请使用新密码重新登录"}
