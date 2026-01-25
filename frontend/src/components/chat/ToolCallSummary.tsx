// ToolCallSummary component - Display tool call summary
import { type FC, type ReactNode } from 'react';
import { Tag } from 'antd';
import { type ToolCallData } from '../../types/chat';

interface ToolCallSummaryProps {
  toolCall: ToolCallData;
  detailsButton?: ReactNode; // 可选的详情按钮
}

export const ToolCallSummary: FC<ToolCallSummaryProps> = ({ toolCall, detailsButton }) => {
  const getStatusConfig = (status: string) => {
    const configs = {
      calling: {
        icon: '⏳',
        text: '执行中',
        color: 'processing' as const
      },
      success: {
        icon: '✅',
        text: '完成',
        color: 'success' as const
      },
      error: {
        icon: '❌',
        text: '失败',
        color: 'error' as const
      }
    };
    return configs[status as keyof typeof configs] || configs.calling;
  };

  const statusConfig = getStatusConfig(toolCall.status);
  const isCalling = toolCall.status === 'calling';

  return (
    <div className="tool-call-summary">
      <div className="tool-call-summary-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span className="icon">🔧</span>
          <span className="tool-name">{toolCall.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag color={statusConfig.color}>
            {statusConfig.icon} {statusConfig.text}
          </Tag>
          {toolCall.duration && !isCalling && (
            <span className="duration" style={{ color: '#8c8c8c', fontSize: '13px' }}>
              {toolCall.duration.toFixed(1)}s
            </span>
          )}
          {/* 详情按钮插槽 */}
          {detailsButton}
        </div>
      </div>

      <div className="tool-call-description">
        {toolCall.description}
      </div>
    </div>
  );
};
