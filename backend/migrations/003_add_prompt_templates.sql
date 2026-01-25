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
-- 1. 成本趋势分析
('查看本月成本趋势',
 '显示当前月份的 AWS 成本趋势图表，包括每日支出明细和环比变化',
 '帮我查看本月的 AWS 成本趋势，包括每日支出明细和环比变化',
 'cost', 'LineChartOutlined', 'aws', 1),

-- 2. EC2 优化建议
('EC2 实例优化建议',
 '分析 EC2 实例的优化建议，包括实例类型调整（Rightsizing）和预留实例推荐',
 '分析我的 EC2 实例，提供 Rightsizing 建议和 Savings Plans 购买机会',
 'cost', 'ThunderboltOutlined', 'aws', 2),

-- 3. 未使用资源检测
('检测未使用的资源',
 '识别未使用的 EBS 卷、弹性 IP、负载均衡器等资源，估算可节省的成本',
 '帮我找出所有未使用的 AWS 资源（EBS 卷、弹性 IP、负载均衡器），并估算可节省的成本',
 'cost', 'DeleteOutlined', 'aws', 3),

-- 4. Savings Plans 推荐
('Savings Plans 购买建议',
 '识别可转换为 Savings Plans 的 EC2 和 Lambda 资源，计算潜在节省金额',
 '分析我的 EC2 和 Lambda 使用模式，推荐适合的 Savings Plans 类型和覆盖范围',
 'cost', 'WalletOutlined', 'aws', 4),

-- 5. 成本异常检测
('成本异常波动检测',
 '检测过去 7 天的成本异常波动，标记超出正常范围的支出',
 '帮我分析过去 7 天的 AWS 成本，标记出异常波动并给出可能原因',
 'cost', 'AlertOutlined', 'aws', 5),

-- 6. 按标签分析成本
('按标签分析成本',
 '按资源标签（如 Environment、Project）分组统计成本，识别高支出部门',
 '按 Environment 标签分组，显示各环境（Production、Staging、Development）的成本占比',
 'cost', 'TagsOutlined', 'aws', 6),

-- 7. Lambda 成本优化
('Lambda 函数优化',
 '分析 Lambda 函数的内存配置、执行时间和调用频率，提供优化建议',
 '分析所有 Lambda 函数的调用次数、内存使用率和执行时间，提供内存和超时配置优化建议',
 'cost', 'FunctionOutlined', 'aws', 7),

-- 8. RDS 成本优化
('RDS 数据库优化',
 '分析 RDS 数据库实例的 CPU、内存使用率，推荐实例类型调整和预留实例',
 '分析 RDS 数据库实例，推荐实例类型调整、预留实例和存储优化机会',
 'cost', 'DatabaseOutlined', 'aws', 8),

-- 9. S3 存储成本优化
('S3 存储成本优化',
 '分析 S3 存储桶的生命周期策略、存储类别分布，推荐使用 Intelligent-Tiering',
 '分析 S3 存储桶，推荐适合的生命周期策略和存储类别（如 Glacier、Intelligent-Tiering）',
 'cost', 'FolderOutlined', 'aws', 9),

-- 10. 预留实例利用率
('预留实例利用率分析',
 '检查现有预留实例的利用率，识别未充分使用或即将到期的预留实例',
 '显示所有预留实例的利用率，标记出利用率低于 80% 或即将在 30 天内到期的预留实例',
 'cost', 'PercentageOutlined', 'aws', 10);

-- GCP 成本分析模板
INSERT INTO prompt_templates (title, description, prompt_text, category, icon, cloud_provider, display_order) VALUES
-- 11. GCP 成本按项目分组
('GCP 成本按项目分组',
 '显示 GCP 成本按项目的分组统计，识别 Top 5 高消费项目',
 '查看本月 GCP 成本，按项目分组，显示 Top 5 消费项目及其成本趋势',
 'cost', 'PieChartOutlined', 'gcp', 11),

-- 12. Compute Engine 优化
('Compute Engine 优化建议',
 'GCP 虚拟机实例的 Machine Type 优化建议，识别过度配置的实例',
 '分析我的 Compute Engine 实例，提供 Machine Type 优化建议（如 N1 → N2、E2）',
 'cost', 'CloudServerOutlined', 'gcp', 12),

-- 13. BigQuery 成本分析
('BigQuery 查询成本优化',
 '分析 BigQuery 查询成本，找出高成本查询并提供优化建议（如分区表、聚簇表）',
 '分析 BigQuery 的查询成本，找出高成本查询并提供优化建议（使用分区、聚簇、缓存）',
 'cost', 'SearchOutlined', 'gcp', 13),

-- 14. GCP 承诺使用折扣
('GCP 承诺使用折扣（CUD）',
 '识别适合购买承诺使用折扣（Committed Use Discounts）的 Compute Engine 资源',
 '分析 Compute Engine 使用模式，推荐 1 年期或 3 年期承诺使用折扣（CUD）购买建议',
 'cost', 'ScheduleOutlined', 'gcp', 14),

-- 15. Cloud Storage 成本优化
('Cloud Storage 成本优化',
 '分析 Cloud Storage 存储桶的生命周期管理，推荐使用 Nearline、Coldline 或 Archive',
 '分析 Cloud Storage 存储桶，推荐适合的存储类别（Standard、Nearline、Coldline、Archive）',
 'cost', 'CloudUploadOutlined', 'gcp', 15),

-- 16. RI/SP 利用率分析
('RI/SP 利用率分析',
 'Savings Plans、RDS RI 和 ElastiCache RI 的利用率和浪费情况查询',
 '# 任务

Savings Plans、RDS RI 和 ElastiCache RI 的利用率和浪费情况查询

# 参数配置

在开始分析前，请确认以下参数

- 时间范围: 本月至今
- 输出内容：详细数据，汇总数据

# 数据查询

严格按照如下步骤查询相关数据，禁止跳过任何步骤

## 第 1 步：查询 Savings Plans 利用率

- 查询每个账号的每个Savings Plan ID的利用率
- 根据Savings Plans的利用率数据，对查询到的每个账号的每个Savings Plan ID，计算浪费的每小时承诺量：
    **数据提取规则**
    - 每个SP的每小时承诺量：直接使用API返回的`HourlyCommitment`字段值
    - 每个SP的利用率：使用API返回的`UtilizationPercentage`字段值
    - 每个SP的浪费每小时承诺量 = HourlyCommitment × (1 - UtilizationPercentage/100)

## 第 2 步：查询ElastiCache RI 利用率

- 查询每个账号购买的每一笔 ElastiCache RI 的利用率。

## 第 3 步：查询 RDS RI 利用率

- 查询每个账号购买的每一笔 RDS RI 的利用率。

## 第 4 步：计算 RI 浪费情况

- ** 对每个账号的每一笔 RDS RI 与 ElastiCache RI，单独计算浪费情况**
- ** 计算方式：浪费的 RI 数量 = RI 数量 × (1 - 利用率) **

# 查询结果输出

按照如下要求输出查询到的数据

## 1. Payer账号下的每个Linked账号的详细利用率情况

### 1.1 Payer账号下的每个Linked账号的每条Savings Plans的利用率情况

输出格式

| Payer Account ID (Name) | Linked Account ID | Savings Plans ID | 每小时承诺量 | 利用率 | 每小时浪费承诺量 | 到期时间 |
|-------------------------|------------------|-----------------|--------------|--------|-----------------|----------|
| 000000000000 (juyun-payer-2658) | 000000000000 | 3d81ace9-5cf6-46ec-82f8-10c6cc70c7e1 | $x.xx | xx.xx% | $x.xx | 0000-00-00 |
| …（支持多条记录）             | …                | …               | …            | …      | …               | …        |

### 1.2 Payer账号下的每个Linked账号的每一笔 RDS RI 利用率

输出格式

| Payer Account ID (Name) | Linked Account ID | Region | Subscription ID | 实例类型 | RI 数量 | RI 利用率 | 浪费的 RI 数量 | 到期时间 |
|-------------------------|------------------|--------|-----------------|----------|---------|-----------|----------------|----------|
| 000000000000 (juyun-payer-2658) | 000000000000 | us-east-1 | 00000000000 | db.t3.micro | 1 | xx.xx% | 0 | 0000-00-00 |
| …（支持多条记录）             | …                | …      | …               | …        | …       | …         | …              | …        |

### 1.3 Payer账号下的每个Linked账号的每一笔 ElastiCache RI 利用率

输出格式

| Payer Account ID (Name) | Linked Account ID | Region | Subscription ID | 实例类型 | RI 数量 | RI 利用率 | 浪费的 RI 数量 | 到期时间 |
|-------------------------|------------------|--------|-----------------|----------|---------|-----------|----------------|----------|
| 000000000000 (juyun-payer-2658) | 000000000000 | us-east-1 | 00000000000 | db.t3.micro | 1 | xx.xx% | 0 | 0000-00-00 |
| …（支持多条记录）             | …                | …      | …               | …        | …       | …         | …              | …        |

## 2. Payer的汇总利用率情况

### 2.1 Payer账号Savings Plans的汇总利用率情况

输出格式

| Payer Account ID (Name) | 总每小时承诺量 | 总体利用率 | 总浪费每小时承诺量 |
|-------------------------|--------------|-----------|-------------------|
| 000000000000 (juyun-payer-0000) | $x.xx | xx.xx% | $x.xx |
| …（支持多条记录）             | …      | …       | …                 |
| 汇总数据（全部 Payer）         | 总每小时承诺量求和 | 平均总体利用率 | 总浪费每小时承诺量求和 |

- 输出前验证总每小时承诺量、和总浪费每小时承诺量的准确性
    **汇总计算规则**：
    - Payer账号的总**每小时**承诺量 = Payer账号下关联的所有Linked账号下的所有SP的HourlyCommitment之和
    - Payer账号的总浪费**每小时**承诺量 = Payer账号下关联的所有Linked账号下的所有SP浪费每小时承诺量之和
    - 总体利用率 = (总每小时承诺量 - 总浪费每小时承诺量) / 总每小时承诺量 × 100%

### 2.2 Payer账号的 RDS RI 和 ElastiCache RI 的汇总利用率情况

输出格式

| Payer Account ID (Name) | 总体 RDS RI利用率 | 总体 ElastiCache RI利用率 |
|-------------------------|------------------|--------------------------|
| 000000000000 (juyun-payer-0000) | xx.xx% | xx.xx% |
| …（支持多条记录）             | …        | …                        |

## 3. Payer下所有Linked账号每天的SP和RDS RI、ElastiCache RI的利用率情况

| 承诺类型 | 1日 | ... | ... |
|-------------------------|----------|-------|-----|-------|
| SP 利用率 | xx.xx% | ... | xx.xx% |
| RDS RI 利用率 | xx.xx% | ... | xx.xx% |
| ElastiCache RI 利用率 | xx.xx% | ... | xx.xx% |
| …        | …     | ... | …     |

# 核心原则

## 要求

- **输出所有Payer下的所有Linked账号下的所有的Savings Plans和RI的详细列表**

## 禁止

- **严禁虚构数据，禁止估算数据，严格按照查询到的数据进行分析**
- **按要求输出查询结果，严禁补充任何额外的总结、分析或者建议**
- **一步一步进行查询，你有充足的时间和响应长度完成所有查询，严禁简化查询或跳过任何步骤，严禁进行快速查询**

## 校验

- **输出前校验所有数据已经成功获取**
- **输出前校验所有的查询逻辑和数据结果的准确性**
- **输出前复核每个Payer的总每小时承诺量、总体 RDS RI利用率、总体ElastiCache RI利用率**

## 输出确认

- **检查输出内容参数**
    - 如果输出内容为"汇总数据"，则只输出第2部分"每个Payer的汇总利用率情况"，严禁输出第1部分"每个Payer账号下的每个Linked账号的详细利用率情况"
    - 如果输出内容为"详细数据"，则只输出第1部分"每个Payer账号下的每个Linked账号的详细利用率情况"，严禁输出第2部分"每个Payer的汇总利用率情况"
    - 如果输出内容为"详细数据、汇总数据"，则输出第1部分"每个Payer账号下的每个Linked账号的详细利用率情况"和第2部分"每个Payer的汇总利用率情况"',
 'cost', 'PercentageOutlined', 'aws', 2);

-- ========== 5. 插入斜杠命令映射 ==========

-- AWS 成本命令
INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-trend', id, '💰 显示本月 AWS 成本趋势'
FROM prompt_templates WHERE title = '查看本月成本趋势';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-ec2', id, '⚡ EC2 实例优化建议'
FROM prompt_templates WHERE title = 'EC2 实例优化建议';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-unused', id, '🗑️ 检测未使用的资源'
FROM prompt_templates WHERE title = '检测未使用的资源';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-savings', id, '💵 Savings Plans 购买建议'
FROM prompt_templates WHERE title = 'Savings Plans 购买建议';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-anomaly', id, '⚠️ 成本异常波动检测'
FROM prompt_templates WHERE title = '成本异常波动检测';

-- GCP 成本命令
INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-gcp', id, '📊 GCP 成本按项目分组'
FROM prompt_templates WHERE title = 'GCP 成本按项目分组';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'cost-gce', id, '☁️ Compute Engine 优化建议'
FROM prompt_templates WHERE title = 'Compute Engine 优化建议';

INSERT INTO slash_commands (command, template_id, description)
SELECT 'ri-sp-utilization', id, '📈 RI/SP 利用率分析'
FROM prompt_templates WHERE title = 'RI/SP 利用率分析';

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

    IF template_count < 16 THEN
        RAISE EXCEPTION '❌ 模板数量不足，期望至少 16 个，实际 %', template_count;
    END IF;
END $$;

COMMIT;

-- ========== 完成 ==========
-- 迁移完成时间: NOW()
-- 预期结果:
--   - 3 张新表创建成功
--   - 15 个成本相关模板插入成功
--   - 7 个斜杠命令创建成功
