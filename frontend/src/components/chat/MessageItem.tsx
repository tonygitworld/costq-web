// MessageItem component - Individual message display
import { type FC, memo } from 'react';
import { Avatar, Typography, Button, Tooltip, Alert } from 'antd';
import { UserOutlined, RobotOutlined, DownloadOutlined, CopyOutlined, StopOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { type Message } from '../../types/chat';
import { HoverStableCard } from '../common/HoverStableCard';
import { SafeMarkdownRenderer } from '../common/SafeMarkdownRenderer';
import { exportMessageToPDF } from '../../utils/pdfExport';
import { useI18n } from '../../hooks/useI18n';
import dayjs from 'dayjs';

// ✨ 新增：导入 Agent 工作流程展示组件
import { ThinkingSummary } from './ThinkingSummary';
import { ToolCallWithDetails } from './ToolCallWithDetails';
import StatusCard from './StatusCard';

// ✨ 新增：导入样式
import './MessageItem.css';
import './MessageLayout.css';

import { logger } from '../../utils/logger';

const { Text } = Typography;

interface MessageItemProps {
  message: Message;
}

const MessageItemComponent: FC<MessageItemProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const { t } = useI18n('chat');

  // PDF下载处理
  const handleDownloadPDF = () => {
    exportMessageToPDF(message.content, message.timestamp);
  };

  // 复制处理
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  if (isUser) {
    // 用户消息的简单显示
    return (
      <div className="user-message-container">
        <div className="user-message-wrapper">
          <Avatar
            icon={<UserOutlined />}
            size={32}
            className="user-avatar"
          />
          <div className="user-message-content-wrapper">
            <HoverStableCard
              size="small"
              className="user-message-card"
            >
              <div className="user-message-text">
                {message.content}
              </div>
            </HoverStableCard>

            {/* 用户消息的操作区域 - 时间戳和复制按钮横向排列 */}
            <div className="user-message-actions">
              <Text type="secondary" className="user-message-timestamp">
                {dayjs(message.timestamp).format('HH:mm')}
              </Text>
              <Tooltip title={t('message.copyContent')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                  className="user-message-copy-btn"
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 提取判断是否有内容的逻辑，避免重复
  const hasContent = (message.content && message.content.trim() !== '') ||
                     (message.contentBlocks && message.contentBlocks.length > 0) ||
                     message.thinking;

  // 🔍 检查是否有正在执行的工具
  const hasCallingTools = message.contentBlocks?.some(
    block => block.type === 'tool_call' && block.toolCall.status === 'calling'
  ) ?? false;

  // 🔍 统计工具状态
  const toolCallsStatus = message.contentBlocks
    ?.filter(block => block.type === 'tool_call')
    .map(block => ({
      name: block.toolCall.name,
      status: block.toolCall.status
    })) ?? [];

  // 🔍 调试：检查是否应该显示操作按钮
  // ✅ 关键修复：必须同时满足:
  // 1. 有实际内容
  // 2. 消息状态不是 streaming（整个响应流结束）
  // 3. 没有正在执行的工具调用
  // 4. 消息状态为终态（completed/failed/cancelled）
  const shouldShowActions = hasContent &&
    !message.meta.isStreaming &&
    !hasCallingTools &&
    (message.meta.status === 'completed' || message.meta.status === 'failed' || message.meta.status === 'cancelled');

  if (message.type === 'assistant' && (message.contentBlocks?.length ?? 0) > 0) {
    logger.debug('🔍 [MessageItem] 操作按钮显示条件检查:', {
      messageId: message.id,
      isStreaming: message.meta.isStreaming,
      status: message.meta.status,
      hasContent,
      hasCallingTools,
      shouldShowActions,
      contentBlocksCount: message.contentBlocks?.length ?? 0,
      toolCallsStatus  // 🆕 显示所有工具的状态
    });
  }

  // AI消息的复杂显示（包含进度和响应）
  return (
    <div className="ai-message-container">
      <div className="ai-message-wrapper">
        <Avatar
          icon={<RobotOutlined />}
          size={32}
          className="ai-avatar"
        />

        <div className="ai-message-content-wrapper">
          {/* ✨ 新增：消息头 */}
          <div className="ai-message-header">
            <Text strong className="ai-message-assistant-label">
              {t('message.assistant')}
            </Text>
          </div>

          {/* 流式状态提示 - 已移除，使用新格式的思考过程展示 */}

          {/* ✅ 新增：状态提示卡片（无进度条）*/}
          {message.showStatus && message.statusType && message.statusMessage && (
            <StatusCard
              statusType={message.statusType}
              message={message.statusMessage}
              estimatedSeconds={message.statusEstimatedSeconds}
              details={message.statusDetails}
              onComplete={() => {
                // 状态卡片自动隐藏后的回调（可选）
              }}
            />
          )}

          {/* AI响应内容 - 仅当有内容时才显示卡片 */}
          {hasContent && (
            <div
              className="ai-message-card"
            >
              {/* ✨ 思考过程摘要（仅实时查询时显示） */}
              {message.thinking && (
                <ThinkingSummary
                  thinking={message.thinking}
                  isStreaming={message.meta.status === 'streaming'}
                />
              )}

              {/* ✨ 按时间顺序显示内容块（仅实时查询时有 contentBlocks） */}
              {message.contentBlocks && message.contentBlocks.length > 0 ? (
                message.contentBlocks.map((block, index) => {
                  if (block.type === 'text') {
                    return (
                      <div
                        key={`text-${index}`}
                        className="ai-message-text-block"
                      >
                        <SafeMarkdownRenderer content={block.content} />
                      </div>
                    );
                  } else if (block.type === 'tool_call') {
                    return (
                      <div
                        key={`tool-${block.toolCall.id}`}
                        className="ai-message-text-block"
                      >
                        <ToolCallWithDetails toolCall={block.toolCall} />
                      </div>
                    );
                  }
                  return null;
                })
              ) : (
                <>
                  {/* ✅ 刷新后只显示最终文本内容（不显示工具调用） */}
                  {message.content &&
                   !message.content.startsWith('🤔') &&
                   !message.content.startsWith('正在分析') &&
                   !message.content.startsWith('AI 正在') && (
                    <SafeMarkdownRenderer content={message.content} />
                  )}
                </>
              )}

              {/* ✅ Token 使用统计 - 集成到消息卡片内部底部 */}
              {message.meta.status === 'completed' && message.tokenUsage && (
                <div className="token-usage-inline">
                  <div className="token-usage-divider"></div>
                  <div className="token-usage-compact">
                    <span className="token-usage-label">{t('tokenUsage.label')}</span>
                    <span className="token-stat-inline">
                      {t('tokenUsage.input')}: <strong>{message.tokenUsage.input_tokens.toLocaleString()}</strong>
                    </span>
                    <span className="token-stat-inline">
                      {t('tokenUsage.output')}: <strong>{message.tokenUsage.output_tokens.toLocaleString()}</strong>
                    </span>
                    {message.tokenUsage.cache_read_tokens > 0 && (
                      <span className="token-stat-inline token-cache-read">
                        {t('tokenUsage.cacheRead')}: <strong>{message.tokenUsage.cache_read_tokens.toLocaleString()}</strong>
                        <span className="token-cache-rate"> ({t('tokenUsage.cacheRate', { rate: message.tokenUsage.input_cache_hit_rate })})</span>
                      </span>
                    )}
                    {message.tokenUsage.cache_write_tokens > 0 && (
                      <span className="token-stat-inline token-cache-write">
                        {t('tokenUsage.cacheWrite')}: <strong>{message.tokenUsage.cache_write_tokens.toLocaleString()}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ✅ 新增：取消状态警告 */}
          {message.meta.status === 'cancelled' && (
            <Alert
              message={t('message.generationStopped')}
              description={t('message.generationStoppedDesc')}
              type="warning"
              showIcon
              icon={<StopOutlined />}
              style={{
                marginTop: '12px',
                borderRadius: '8px'
              }}
            />
          )}

          {/* ✅ P0：页面刷新中断状态 */}
          {message.meta.status === 'interrupted' && (
            <Alert
              message={t('message.interruptedByRefresh')}
              description={t('message.interruptedDesc', {
                time: message.meta.interruptedAt ? dayjs(message.meta.interruptedAt).format('HH:mm:ss') : ''
              })}
              type="info"
              showIcon
              style={{
                marginTop: '12px',
                borderRadius: '8px'
              }}
            />
          )}

          {/* ✅ 新增：失败状态警告 */}
          {message.meta.status === 'failed' && message.meta.error && (
            <Alert
              message={t('message.analysisFailed')}
              description={message.meta.error.message || t('message.analysisFailedDesc')}
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{
                marginTop: '12px',
                borderRadius: '8px'
              }}
            />
          )}

          {/* 操作按钮区域 - 仅当消息完成、失败或取消时才显示 */}
          {shouldShowActions && (
            <div className="ai-message-actions">
              {/* 时间戳 - 根据状态显示不同内容 */}
              {message.meta.status === 'completed' && (
                <Text type="secondary" className="ai-message-timestamp" style={{ marginRight: 'var(--spacing-xs)' }}>
                  {dayjs(message.timestamp).format('HH:mm')}
                </Text>
              )}
              {message.meta.status === 'failed' && (
                <Text type="secondary" className="ai-message-timestamp" style={{ marginRight: 'var(--spacing-xs)' }}>
                  <span style={{ color: '#ff4d4f' }}>{t('message.analysisFailed')}</span>
                </Text>
              )}
              {message.meta.status === 'cancelled' && (
                <Text type="secondary" className="ai-message-timestamp" style={{ marginRight: 'var(--spacing-xs)' }}>
                  <span style={{ color: '#fa8c16' }}>{t('message.stopped')}</span>
                </Text>
              )}

              {/* 操作按钮 - 仅在消息完成时显示 */}
              {message.meta.status === 'completed' && message.content && (
                <>
                  <Tooltip title={t('message.copyContent')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={handleCopy}
                      className="ai-message-action-btn"
                      style={{ color: '#8c8c8c' }}
                    />
                  </Tooltip>

                  <Tooltip title={t('message.downloadPDF')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadPDF}
                      className="ai-message-action-btn"
                      style={{ color: '#667eea' }}
                    />
                  </Tooltip>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ✅ 使用 React.memo 优化渲染性能，避免不必要的重渲染
export const MessageItem = memo(MessageItemComponent, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键属性变化时重渲染
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  return (
    prevMsg.id === nextMsg.id &&
    prevMsg.content === nextMsg.content &&
    prevMsg.meta?.status === nextMsg.meta?.status &&
    prevMsg.meta?.isStreaming === nextMsg.meta?.isStreaming &&
    prevMsg.meta?.streamingProgress === nextMsg.meta?.streamingProgress &&
    prevMsg.thinking === nextMsg.thinking &&
    prevMsg.toolCalls?.length === nextMsg.toolCalls?.length &&
    prevMsg.contentBlocks?.length === nextMsg.contentBlocks?.length &&
    prevMsg.showStatus === nextMsg.showStatus
  );
});
