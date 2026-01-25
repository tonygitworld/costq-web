// ThinkingSummary component - Display agent thinking process summary
//
// TODO: 后续扩展计划
// =====================================================================
// 当前版本显示简单的"正在思考..."步骤列表（已暂时隐藏）
//
// 计划实现 2025 年最佳实践的思考过程可视化：
//
// Phase 1: 智能生成思考步骤（1-2天）
//   - 迁移 Main 分支的智能生成逻辑
//   - 增强工具调用描述（显示参数和结果）
//   - 添加状态图标（✅⏳❌）
//
// Phase 2: 结构化显示（3-5天）
//   - 四阶段架构：理解查询 → 数据收集 → 数据分析 → 生成回复
//   - 可折叠交互组件（Collapse）
//   - 实时更新机制
//
// Phase 3: 高级可视化（1-2周）
//   - 时间线视图（Timeline）
//   - 置信度指标（Progress）
//   - 性能监控（耗时、Token 使用）
//
// 参考文档：
//   - docs/thinking_process_2025_best_practices.md
//   - docs/thinking_process_comparison.md
//   - docs/thinking_process_analysis.md
// =====================================================================

import { type FC } from 'react';
import { Spin } from 'antd';
import { type ThinkingData } from '../../types/chat';

interface ThinkingSummaryProps {
  thinking: ThinkingData;
  isStreaming?: boolean;
}

export const ThinkingSummary: FC<ThinkingSummaryProps> = ({ thinking, isStreaming = false }) => {
  // 如果没有思考数据，不显示
  if (!thinking) {
    return null;
  }

  const hasSteps = thinking.steps && thinking.steps.length > 0;

  return (
    <div className="thinking-summary">
      <div className="thinking-summary-header">
        <span className="icon">💭</span>
        <span className="label">思考过程</span>
        {/* 移除耗时显示，因为这是预生成的步骤，不是真实的思考时间 */}
      </div>

      {/* 如果正在流式且没有步骤，显示加载状态 */}
      {isStreaming && !hasSteps ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          color: '#8b5cf6'
        }}>
          <Spin size="small" />
          <span style={{ fontSize: '13px' }}>CostQ 正在初始化账号...</span>
        </div>
      ) : (
        hasSteps && (
          <ul className="thinking-steps">
            {thinking.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
};
