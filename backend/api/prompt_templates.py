"""Prompt Templates API

提供提示词模板的 CRUD 操作和执行功能
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status


def _utc_now() -> datetime:
    """返回当前 UTC 时间"""
    return datetime.now(timezone.utc)
from sqlalchemy import text

from ..database import get_db
from ..models.prompt_template import (
    PromptTemplate,
    SlashCommand,
    TemplateExecuteRequest,
    TemplateExecuteResponse,
    UserPromptTemplate,
    UserPromptTemplateCreate,
    UserPromptTemplateUpdate,
)
from ..services.template_renderer import render_template
from ..utils.auth import get_current_user

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Prompt Templates"])


# ========== 辅助函数 ==========


def convert_row_to_dict(row):
    """将数据库行转换为字典，处理 UUID 类型"""
    row_dict = dict(row._mapping)
    # 将 UUID 对象转换为字符串
    for key, value in row_dict.items():
        if isinstance(value, uuid.UUID):
            row_dict[key] = str(value)
    return row_dict


# ========== 系统预设模板 ==========


@router.get("/prompt-templates", response_model=list[PromptTemplate])
async def get_system_templates(
    category: str | None = Query(
        None, description="按分类筛选 (cost/security/inventory/onboarding)"
    ),
    cloud_provider: str | None = Query(None, description="按云服务商筛选 (aws/gcp/both)"),
    db=Depends(get_db),
):
    """获取系统预设模板列表"""
    try:
        query = "SELECT * FROM prompt_templates WHERE is_active = TRUE"
        params = {}

        if category:
            query += " AND category = :category"
            params["category"] = category

        if cloud_provider:
            query += " AND (cloud_provider = :cloud_provider OR cloud_provider = 'both' OR cloud_provider IS NULL)"
            params["cloud_provider"] = cloud_provider

        query += " ORDER BY display_order ASC, created_at DESC"

        result = db.execute(text(query), params)
        rows = result.fetchall()
        templates = []

        for row in rows:
            row_dict = convert_row_to_dict(row)
            # 解析 JSON 变量字段
            if row_dict.get("variables"):
                try:
                    row_dict["variables"] = json.loads(row_dict["variables"])
                except:
                    row_dict["variables"] = None
            templates.append(row_dict)

        logger.info(
            f"✅ 获取系统模板成功 - Category: {category}, Cloud: {cloud_provider}, Count: {len(templates)}"
        )
        return templates

    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"获取模板失败: {str(e)}")


@router.get("/prompt-templates/{template_id}", response_model=PromptTemplate)
async def get_system_template(template_id: str, db=Depends(get_db)):
    """获取单个系统模板详情"""
    try:
        result = db.execute(
            text("SELECT * FROM prompt_templates WHERE id = :template_id"),
            {"template_id": template_id},
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="模板不存在")

        row_dict = convert_row_to_dict(row)
        if row_dict.get("variables"):
            try:
                row_dict["variables"] = json.loads(row_dict["variables"])
            except:
                row_dict["variables"] = None

        logger.info("- ID: %s", template_id)
        return row_dict

    except HTTPException:
        raise
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"获取模板失败: {str(e)}")


# ========== 执行模板 ==========


@router.post("/prompt-templates/{template_id}/execute", response_model=TemplateExecuteResponse)
async def execute_template(
    template_id: str,
    request: TemplateExecuteRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """执行模板（渲染变量并增加使用计数）"""
    try:
        # 查找系统模板
        result = db.execute(
            text("SELECT * FROM prompt_templates WHERE id = :template_id"),
            {"template_id": template_id},
        )
        row = result.fetchone()

        is_user_template = False

        # 如果没有，查找用户模板
        if not row:
            result = db.execute(
                text(
                    "SELECT * FROM user_prompt_templates WHERE id = :template_id AND user_id = :user_id"
                ),
                {"template_id": template_id, "user_id": current_user["id"]},
            )
            row = result.fetchone()
            is_user_template = True

        if not row:
            raise HTTPException(status_code=404, detail="模板不存在")

        template_data = convert_row_to_dict(row)

        # 渲染模板
        try:
            rendered_prompt = render_template(template_data["prompt_text"], request.variables or {})
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # 增加使用计数
        table_name = "user_prompt_templates" if is_user_template else "prompt_templates"
        db.execute(
            text(f"UPDATE {table_name} SET usage_count = usage_count + 1 WHERE id = :template_id"),
            {"template_id": template_id},
        )
        db.commit()

        new_usage_count = template_data["usage_count"] + 1

        logger.info(
            f"✅ 执行模板成功 - User: {current_user['id']}, Template: {template_id}, "
            f"Variables: {request.variables}, UsageCount: {new_usage_count}"
        )

        return TemplateExecuteResponse(
            template_id=template_id, rendered_prompt=rendered_prompt, usage_count=new_usage_count
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"执行模板失败: {str(e)}")


# ========== 斜杠命令 ==========


@router.get("/slash-commands", response_model=list[SlashCommand])
async def get_slash_commands(db=Depends(get_db)):
    """获取斜杠命令列表"""
    try:
        result = db.execute(
            text("SELECT * FROM slash_commands WHERE is_active = TRUE ORDER BY command ASC")
        )
        rows = result.fetchall()
        commands = [convert_row_to_dict(row) for row in rows]
        logger.info("✅ 获取斜杠命令成功 - Count: {len(commands)}")
        return commands

    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"获取斜杠命令失败: {str(e)}")


# ========== 用户自定义模板 (暂时简化实现) ==========


@router.get("/user-prompt-templates", response_model=list[UserPromptTemplate])
async def get_user_templates(
    current_user: dict = Depends(get_current_user),
    only_favorites: bool = Query(False, description="仅显示收藏的模板"),
    db=Depends(get_db),
):
    """获取用户自定义模板列表"""
    try:
        query = "SELECT * FROM user_prompt_templates WHERE user_id = :user_id"
        params = {"user_id": current_user["id"]}

        if only_favorites:
            query += " AND is_favorite = TRUE"

        query += " ORDER BY is_favorite DESC, updated_at DESC"

        result = db.execute(text(query), params)
        rows = result.fetchall()
        templates = []

        for row in rows:
            row_dict = convert_row_to_dict(row)
            if row_dict.get("variables"):
                try:
                    row_dict["variables"] = json.loads(row_dict["variables"])
                except:
                    row_dict["variables"] = None
            templates.append(row_dict)
        logger.info("- User: %s, Count: {len(templates)}", current_user['id'])
        return templates

    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"获取模板失败: {str(e)}")


@router.post(
    "/user-prompt-templates", response_model=UserPromptTemplate, status_code=status.HTTP_201_CREATED
)
async def create_user_template(
    template: UserPromptTemplateCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """创建用户自定义模板"""
    try:
        # 暂时不验证模板语法，因为用户可能使用高级语法（如默认值）
        # 验证会在执行模板时进行
        # validate_template(template.prompt_text)

        template_id = str(uuid.uuid4())
        now = _utc_now().isoformat()

        # 序列化变量为 JSON
        variables_json = None
        if template.variables:
            variables_json = json.dumps([v.dict() for v in template.variables])

        db.execute(
            text("""
            INSERT INTO user_prompt_templates
            (id, user_id, title, description, prompt_text, category, variables, created_at, updated_at)
            VALUES (:id, :user_id, :title, :description, :prompt_text, :category, :variables, :created_at, :updated_at)
        """),
            {
                "id": template_id,
                "user_id": current_user["id"],
                "title": template.title,
                "description": template.description,
                "prompt_text": template.prompt_text,
                "category": template.category,
                "variables": variables_json,
                "created_at": now,
                "updated_at": now,
            },
        )
        db.commit()

        # 返回创建的模板
        result = db.execute(
            text("SELECT * FROM user_prompt_templates WHERE id = :id"), {"id": template_id}
        )
        row = result.fetchone()
        row_dict = convert_row_to_dict(row)
        if row_dict.get("variables"):
            try:
                row_dict["variables"] = json.loads(row_dict["variables"])
            except:
                row_dict["variables"] = None

        logger.info(
            f"✅ 创建用户模板成功 - User: {current_user['id']}, Template: {template_id}, Title: {template.title}"
        )
        return row_dict

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"创建模板失败: {str(e)}")


@router.put("/user-prompt-templates/{template_id}", response_model=UserPromptTemplate)
async def update_user_template(
    template_id: str,
    template: UserPromptTemplateUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """更新用户自定义模板"""
    try:
        # 检查模板是否存在且属于当前用户
        result = db.execute(
            text("SELECT * FROM user_prompt_templates WHERE id = :id AND user_id = :user_id"),
            {"id": template_id, "user_id": current_user["id"]},
        )
        existing = result.fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="模板不存在或无权限访问")

        # 构建更新语句
        update_fields = []
        params = {"id": template_id}

        if template.title is not None:
            update_fields.append("title = :title")
            params["title"] = template.title

        if template.description is not None:
            update_fields.append("description = :description")
            params["description"] = template.description

        if template.prompt_text is not None:
            # 暂时不验证模板语法
            update_fields.append("prompt_text = :prompt_text")
            params["prompt_text"] = template.prompt_text

        if template.category is not None:
            update_fields.append("category = :category")
            params["category"] = template.category

        if template.variables is not None:
            variables_json = (
                json.dumps([v.dict() for v in template.variables]) if template.variables else None
            )
            update_fields.append("variables = :variables")
            params["variables"] = variables_json

        # 更新时间
        now = _utc_now().isoformat()
        update_fields.append("updated_at = :updated_at")
        params["updated_at"] = now

        # 执行更新
        db.execute(
            text(f"""
            UPDATE user_prompt_templates
            SET {", ".join(update_fields)}
            WHERE id = :id
        """),
            params,
        )
        db.commit()

        # 返回更新后的模板
        result = db.execute(
            text("SELECT * FROM user_prompt_templates WHERE id = :id"), {"id": template_id}
        )
        row = result.fetchone()
        row_dict = convert_row_to_dict(row)
        if row_dict.get("variables"):
            try:
                row_dict["variables"] = json.loads(row_dict["variables"])
            except:
                row_dict["variables"] = None

        logger.info("- User: %s, Template: %s", current_user['id'], template_id)
        return row_dict

    except HTTPException:
        raise
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"更新模板失败: {str(e)}")


@router.delete("/user-prompt-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_template(
    template_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)
):
    """删除用户自定义模板"""
    try:
        # 检查模板是否存在且属于当前用户
        result = db.execute(
            text("SELECT * FROM user_prompt_templates WHERE id = :id AND user_id = :user_id"),
            {"id": template_id, "user_id": current_user["id"]},
        )
        existing = result.fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="模板不存在或无权限访问")

        # 删除模板
        db.execute(text("DELETE FROM user_prompt_templates WHERE id = :id"), {"id": template_id})
        db.commit()
        logger.info("- User: %s, Template: %s", current_user['id'], template_id)
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"删除模板失败: {str(e)}")


@router.post("/user-prompt-templates/{template_id}/favorite")
async def toggle_user_template_favorite(
    template_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)
):
    """切换用户模板的收藏状态"""
    try:
        # 检查模板是否存在且属于当前用户
        result = db.execute(
            text(
                "SELECT is_favorite FROM user_prompt_templates WHERE id = :id AND user_id = :user_id"
            ),
            {"id": template_id, "user_id": current_user["id"]},
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="模板不存在或无权限访问")

        # 切换收藏状态
        current_favorite = row[0]  # is_favorite 是第一列
        new_favorite = False if current_favorite else True

        db.execute(
            text(
                "UPDATE user_prompt_templates SET is_favorite = :is_favorite, updated_at = :updated_at WHERE id = :id"
            ),
            {
                "is_favorite": new_favorite,
                "updated_at": _utc_now().isoformat(),
                "id": template_id,
            },
        )
        db.commit()
        logger.info(
            f"✅ 切换收藏成功 - User: {current_user['id']}, Template: {template_id}, Favorite: {new_favorite}"
        )
        return {"is_favorite": new_favorite}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(": %s", e)
        raise HTTPException(status_code=500, detail=f"切换收藏失败: {str(e)}")
