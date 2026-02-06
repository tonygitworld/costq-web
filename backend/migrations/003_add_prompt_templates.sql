-- ========================================
-- Prompt Templates 数据库迁移脚本
-- 版本: 003
-- 日期: 2025-10-15
-- 描述: 添加提示词模板功能（仅成本相关）
-- ========================================

BEGIN;

-- ========== 1. 创建系统预设模板表 ==========

CREATE TABLE IF NOT EXISTS prompt_templates (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 基本信息
    title VARCHAR(100) NOT NULL,
    description TEXT,
    prompt_text TEXT NOT NULL,

    -- 分类和标签
    category VARCHAR(50) NOT NULL,
    icon VARCHAR(50),
    cloud_provider VARCHAR(20),

    -- 变量定义（JSONB 格式）
    variables JSONB,

    -- 统计和状态
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束
    CONSTRAINT chk_category CHECK (category IN ('cost', 'security', 'inventory', 'onboarding', 'custom')),
    CONSTRAINT chk_cloud_provider CHECK (cloud_provider IN ('aws', 'gcp', 'both') OR cloud_provider IS NULL)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_template_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_template_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_template_order ON prompt_templates(display_order);
CREATE INDEX IF NOT EXISTS idx_template_cloud ON prompt_templates(cloud_provider);

COMMENT ON TABLE prompt_templates IS '系统预设模板表';
COMMENT ON COLUMN prompt_templates.variables IS '变量定义（JSONB 数组）';
COMMENT ON COLUMN prompt_templates.usage_count IS '全局使用次数统计';

-- ========== 2. 创建用户自定义模板表 ==========

CREATE TABLE IF NOT EXISTS user_prompt_templates (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 用户关联
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 基本信息
    title VARCHAR(100) NOT NULL,
    description TEXT,
    prompt_text TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'custom',

    -- 变量定义
    variables JSONB,

    -- 用户特定字段
    is_favorite BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_template_user ON user_prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_template_favorite ON user_prompt_templates(is_favorite);
CREATE INDEX IF NOT EXISTS idx_user_template_updated ON user_prompt_templates(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_template_user_favorite_updated
    ON user_prompt_templates(user_id, is_favorite, updated_at DESC);

COMMENT ON TABLE user_prompt_templates IS '用户自定义模板表';
COMMENT ON COLUMN user_prompt_templates.is_favorite IS '是否收藏';
COMMENT ON COLUMN user_prompt_templates.usage_count IS '个人使用次数';

-- ========== 3. 创建斜杠命令表 ==========

CREATE TABLE IF NOT EXISTS slash_commands (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 命令定义
    command VARCHAR(50) NOT NULL UNIQUE,
    template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
    description TEXT,

    -- 状态
    is_active BOOLEAN DEFAULT TRUE,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_slash_command ON slash_commands(command);
CREATE INDEX IF NOT EXISTS idx_slash_active ON slash_commands(is_active);

COMMENT ON TABLE slash_commands IS '斜杠命令映射表';
COMMENT ON COLUMN slash_commands.command IS '命令名称（不含 /）';

-- ========== 4. 插入初始数据（仅成本相关模板）==========

-- AWS 成本分析模板
INSERT INTO prompt_templates (title, description, prompt_text, category, icon, cloud_provider, display_order) VALUES
-- 1. AWS 成本洞察
('AWS 成本洞察',
 '查询本月排名前 10 的服务成本，进行深度分析和优化建议',
 '# 数据查询和分析
1. 查询本月排名前10的服务成本
2. 查询这10种服务的详细成本项
3. 对查询数据进行分析，深入地进行数据洞察，给出有价值的归因分析以及优化建议
# 要求
1. 同一种服务的成本信息在同一表格简洁输出
2. 查询时间为本月至今',
 'cost', 'LineChartOutlined', 'aws', 1),

-- 2. RI/SP 数据洞察
('RI/SP 数据洞察',
 '查询最近 5 天 Savings Plans、RDS RI 和 ElastiCache RI 的利用率与覆盖率',
 '# 数据查询
1. 最近5天每天的 Savings Plans 的利用率、覆盖率
2. 最近5天每天的 RDS RI 的利用率、覆盖率
3. 最近5天每天的 ElastiCache RI 的利用率、覆盖率
# 要求
1. 并行查询提高查询效率
2. 每种服务每天的覆盖率和利用率在同一个表格简洁输出
3. SP的覆盖率只查询EC2服务',
 'cost', 'PercentageOutlined', 'aws', 2);

-- ========== 5. 插入斜杠命令映射 ==========

-- AWS 成本命令
INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-insight', id, '💰 AWS 成本洞察'
FROM prompt_templates WHERE title = 'AWS 成本洞察';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'ri-sp-data', id, '📊 RI/SP 数据洞察'
FROM prompt_templates WHERE title = 'RI/SP 数据洞察';

-- ========== 6. 验证数据 ==========

DO $$
DECLARE
    template_count INTEGER;
    command_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM prompt_templates;
    SELECT COUNT(*) INTO command_count FROM slash_commands;

    RAISE NOTICE '✅ 数据库迁移完成';
    RAISE NOTICE '   - 系统模板数量: %', template_count;
    RAISE NOTICE '   - 斜杠命令数量: %', command_count;

    IF template_count < 2 THEN
        RAISE EXCEPTION '❌ 模板数量不足，期望至少 2 个，实际 %', template_count;
    END IF;
END $$;

COMMIT;

-- ========== 完成 ==========
-- 迁移完成时间: NOW()
-- 预期结果:
--   - 3 张新表创建成功
--   - 15 个成本相关模板插入成功
--   - 7 个斜杠命令创建成功
