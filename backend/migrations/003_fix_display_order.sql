-- 修复模板显示顺序：将 pt-016 (RI/SP 利用率分析) 移到第2位

-- SQLite & PostgreSQL 通用脚本

-- 先把 display_order >= 2 的模板往后挪
UPDATE prompt_templates
SET display_order = display_order + 1
WHERE display_order >= 2 AND id != 'pt-016' AND category = 'cost';

-- 再把 pt-016 设置为 2
UPDATE prompt_templates
SET display_order = 2
WHERE id = 'pt-016';

-- 验证结果
SELECT display_order, id, title
FROM prompt_templates
WHERE category = 'cost'
ORDER BY display_order
LIMIT 5;
