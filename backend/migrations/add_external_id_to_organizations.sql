-- 为 organizations 表添加 external_id 字段
-- 用于 IAM Role 集成的 External ID

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;

-- 添加注释
COMMENT ON COLUMN organizations.external_id IS 'IAM Role External ID for preventing confused deputy attacks';
