"""聊天历史管理 API"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_serializer

from ..database import get_db
from ..services.chat_storage import get_chat_storage
from ..utils.auth import get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["聊天"])


# ========================================
# 存储服务依赖
# ========================================
def get_storage_service(db=Depends(get_db)):
    """
    获取聊天存储服务实例 (PostgreSQL)
    """
    # get_chat_storage 现在已经配置为返回 PostgreSQL 实现
    # 但为了确保使用当前的 db session，我们直接使用 get_chat_storage
    # (注意：get_chat_storage 内部会创建新的 SessionLocal，这可能不是最佳实践，
    #  但在当前架构下是可行的。更好的做法是让 get_chat_storage 接受 db 参数)

    # 由于 backend/services/chat_storage.py 中的 get_chat_storage
    # 已经重写为使用 ChatStoragePostgreSQL(SessionLocal())，
    # 我们这里可以直接使用它。

    return get_chat_storage()


# Pydantic模型
class ChatSessionCreate(BaseModel):
    """创建聊天会话请求"""

    title: str = Field(..., min_length=1, max_length=200, description="会话标题")
    session_id: str | None = Field(None, description="会话ID（可选，如果提供则使用此ID；否则自动生成）")


class ChatSessionUpdate(BaseModel):
    """更新聊天会话请求"""

    title: str = Field(..., min_length=1, max_length=200, description="会话标题")


class ChatMessageCreate(BaseModel):
    """创建聊天消息请求"""

    type: str = Field(..., pattern="^(user|assistant|system)$", description="消息类型")
    content: str = Field(..., min_length=1, description="消息内容")
    metadata: str | None = Field(None, description="元数据JSON字符串")


class ChatSessionResponse(BaseModel):
    """聊天会话响应"""

    id: str
    user_id: str
    org_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0  # ✅ 新增：消息数量
    total_tokens: int = 0  # ✅ 新增：总Token数

    @field_serializer("created_at", "updated_at")
    def add_utc_suffix(self, value: str) -> str:
        """添加UTC时区标识符（Z后缀）"""
        if value and not value.endswith("Z") and not value.endswith("+00:00"):
            return value + "Z"
        return value


class ChatMessageResponse(BaseModel):
    """聊天消息响应"""

    id: str
    session_id: str
    user_id: str
    type: str
    content: str
    timestamp: str
    token_count: int | None = None
    tool_calls: list | None = None
    tool_results: list | None = None
    metadata: dict | None = None  # ✅ 修改为dict类型，匹配数据库JSONB字段

    @field_serializer("timestamp")
    def add_utc_suffix(self, value: str) -> str:
        """添加UTC时区标识符（Z后缀）"""
        if value and not value.endswith("Z") and not value.endswith("+00:00"):
            return value + "Z"
        return value


# API端点


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    session_create: ChatSessionCreate,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """创建新的聊天会话

    - 自动关联当前用户
    - 返回创建的会话信息
    """
    user_id = current_user["id"]
    org_id = current_user["org_id"]

    try:
        session = chat_storage.create_session(
            user_id=user_id, 
            org_id=org_id, 
            title=session_create.title,
            session_id=session_create.session_id  # ✅ 支持前端提供的 UUID
        )
        return ChatSessionResponse(**session)

    except Exception as e:
        logger.error("- User: %s, Error: %s", user_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"创建会话失败: {str(e)}"
        )


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def get_chat_sessions(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """获取当前用户的聊天会话列表

    - 只返回属于当前用户的会话
    - 按更新时间倒序排列
    """
    user_id = current_user["id"]

    sessions = chat_storage.get_user_sessions(user_id, limit=limit)

    return [ChatSessionResponse(**session) for session in sessions]


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """获取单个会话详情

    权限检查：会话必须属于当前用户
    """
    user_id = current_user["id"]

    session = chat_storage.get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"会话不存在: {session_id}"
        )

    # 权限检查
    if session["user_id"] != user_id:
        logger.warning("- User: %s Session: %s", user_id, session_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该会话")

    return ChatSessionResponse(**session)


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_chat_session(
    session_id: str,
    session_update: ChatSessionUpdate,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """更新会话标题

    权限检查：会话必须属于当前用户
    """
    user_id = current_user["id"]

    # 获取会话并检查权限
    session = chat_storage.get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"会话不存在: {session_id}"
        )

    if session["user_id"] != user_id:
        logger.warning("- User: %s Session: %s", user_id, session_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权修改该会话")

    try:
        chat_storage.update_session_title(session_id, session_update.title)
        updated_session = chat_storage.get_session(session_id)
        return ChatSessionResponse(**updated_session)

    except Exception as e:
        logger.error("- Session: %s, Error: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"更新会话失败: {str(e)}"
        )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """删除会话（级联删除所有消息）

    权限检查：会话必须属于当前用户
    """
    user_id = current_user["id"]

    session = chat_storage.get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"会话不存在: {session_id}"
        )

    if session["user_id"] != user_id:
        logger.warning("- User: %s Session: %s", user_id, session_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该会话")

    try:
        chat_storage.delete_session(session_id)
        logger.info("- Session: %s, User: %s", session_id, user_id)

    except Exception as e:
        logger.error("- Session: %s, Error: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"删除会话失败: {str(e)}"
        )


# 消息相关API


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chat_message(
    session_id: str,
    message_create: ChatMessageCreate,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """保存聊天消息

    权限检查：会话必须属于当前用户
    """
    user_id = current_user["id"]

    # 检查会话权限
    session = chat_storage.get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"会话不存在: {session_id}"
        )

    if session["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该会话")

    try:
        message = chat_storage.save_message(
            session_id=session_id,
            user_id=user_id,
            message_type=message_create.type,
            content=message_create.content,
            metadata=message_create.metadata,
        )
        return ChatMessageResponse(**message)

    except Exception as e:
        logger.error("- Session: %s, Error: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"保存消息失败: {str(e)}"
        )


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_chat_messages(
    session_id: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """获取会话的所有消息

    权限检查：会话必须属于当前用户
    """
    user_id = current_user["id"]

    # 检查会话权限
    session = chat_storage.get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"会话不存在: {session_id}"
        )

    if session["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该会话")

    messages = chat_storage.get_session_messages(session_id, limit=limit)
    return [ChatMessageResponse(**message) for message in messages]


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_message(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    chat_storage=Depends(get_storage_service),
):
    """删除单条消息

    权限检查：消息必须属于当前用户
    """
    user_id = current_user["id"]

    message = chat_storage.get_message(message_id)

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"消息不存在: {message_id}"
        )

    if message["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该消息")

    try:
        chat_storage.delete_message(message_id)
        logger.info("- Message: %s, User: %s", message_id, user_id)

    except Exception as e:
        logger.error("- Message: %s, Error: %s", message_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"删除消息失败: {str(e)}"
        )
