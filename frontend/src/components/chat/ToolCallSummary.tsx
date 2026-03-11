// ToolCallSummary component - Display tool call summary
import { type FC, type ReactNode } from 'react';
import { Tag } from 'antd';
import { type ToolCallData } from '../../types/chat';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useI18n } from '../../hooks/useI18n';

interface ToolCallSummaryProps {
  toolCall: ToolCallData;
  detailsButton?: ReactNode; // 可选的详情按钮
  expanded?: boolean; // 移动端展开状态
}

export const ToolCallSummary: FC<ToolCallSummaryProps> = ({ toolCall, detailsButton, expanded }) => {
  const isMobile = useIsMobile();
  const { t } = useI18n('chat');

  const getStatusConfig = (status: string) => {
    const configs = {
      calling: {
        icon: '⏳',
        text: t('toolCall.callingStatus'),
        color: 'processing' as const,
        dot: '#1890ff',
      },
      success: {
        icon: '✅',
        text: t('toolCall.successStatus'),
        color: 'success' as const,
        dot: '#52c41a',
      },
      error: {
        icon: '❌',
        text: t('toolCall.errorStatus'),
        color: 'error' as const,
        dot: '#ff4d4f',
      },
    };
    return configs[status as keyof typeof configs] || configs.calling;
  };

  const statusConfig = getStatusConfig(toolCall.status);
  const isCalling = toolCall.status === 'calling';

  // ========== 移动端：ChatGPT 风格单行紧凑条 ==========
  if (isMobile) {
    return (
      <div className="tool-call-summary tool-call-summary--mobile">
        <div className="tool-call-summary-header">
          <span
            className="tool-call-dot"
            style={{ backgroundColor: statusConfig.dot }}
          />
          <span
            className="tool-call-label"
            style={expanded ? { wordBreak: 'break-all', whiteSpace: 'normal', overflow: 'visible' } : undefined}
          >
            {t('toolCall.callingTool', { name: toolCall.name })}
          </span>
          <span className="tool-call-meta">
            {isCalling ? (
              <span className="tool-call-spinner" />
            ) : (
              <>
                <Tag
                  color={statusConfig.color}
                  style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}
                >
                  {statusConfig.text}
                </Tag>
                {toolCall.duration && (
                  <span className="duration">{toolCall.duration.toFixed(1)}s</span>
                )}
              </>
            )}
            {detailsButton}
          </span>
        </div>
      </div>
    );
  }

  // ========== 桌面端：保持不变 ==========
  return (
    <div className="tool-call-summary">
      <div className="tool-call-summary-header">
        <div className="tool-call-name-row">
          <span className="icon">🔧</span>
          <span className="tool-name">{toolCall.name}</span>
        </div>
        <div className="tool-call-status-row">
          <Tag color={statusConfig.color}>
            {statusConfig.icon} {statusConfig.text}
          </Tag>
          {toolCall.duration && !isCalling && (
            <span className="duration">
              {toolCall.duration.toFixed(1)}s
            </span>
          )}
          {detailsButton}
        </div>
      </div>

      <div className="tool-call-description">
        {toolCall.description}
      </div>
    </div>
  );
};
