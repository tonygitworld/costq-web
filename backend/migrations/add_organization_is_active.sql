-- ======================================
-- 添加租户启用/禁用功能
-- 日期: 2025-12-24
-- 描述: 为 organizations 表添加 is_active 字段，用于租户审核
-- ======================================

BEGIN;

-- 1. 添加 is_active 字段（默认 FALSE）
ALTER TABLE organizations
ADD COLUMN is_active BOOLEAN DEFAULT FALSE;

-- 2. ✅ 重要：更新现有租户为已激活（避免影响现有用户）
UPDATE organizations
SET is_active = TRUE
WHERE created_at < NOW();

-- 3. 添加索引
CREATE INDEX idx_organizations_is_active ON organizations(is_active);

-- 4. 验证结果
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactive
FROM organizations;

COMMIT;

-- ======================================
-- 回滚脚本（如果需要）
-- ======================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_organizations_is_active;
-- ALTER TABLE organizations DROP COLUMN is_active;
-- COMMIT;
