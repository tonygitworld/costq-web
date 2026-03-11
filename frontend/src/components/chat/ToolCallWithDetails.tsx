// ToolCallWithDetails component - Tool call with collapsible details
import { type FC, useState } from 'react';
import { Button } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { type ToolCallData } from '../../types/chat';
import { ToolCallSummary } from './ToolCallSummary';
import { JsonDisplay } from './JsonDisplay';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ToolCallWithDetailsProps {
  toolCall: ToolCallData;
}

export const ToolCallWithDetails: FC<ToolCallWithDetailsProps> = ({ toolCall }) => {
  // ✨ 调用中时自动展开，完成后可折叠
  const [showDetails, setShowDetails] = useState(false);
  const isCalling = toolCall.status === 'calling';
  const isMobile = useIsMobile();

  // ✅ 修复：检查是否真的有内容（空对象不算有内容）
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;
  const hasDetails = hasArgs || toolCall.result || toolCall.error || (isMobile && toolCall.description);

  // 🔧 修改：不自动展开，只有用户点击时才显示详情
  const shouldShowDetails = hasDetails && showDetails;

  // 详情按钮
  const detailsButton = hasDetails && !isCalling ? (
    <Button
      type="text"
      size="small"
      onClick={() => setShowDetails(!showDetails)}
      icon={showDetails ? <UpOutlined /> : <DownOutlined />}
      style={{
        fontSize: isMobile ? '11px' : '12px',
        color: '#667eea',
        height: isMobile ? '22px' : '24px',
        padding: isMobile ? '0 4px' : '0 8px',
      }}
    >
      {isMobile ? '' : '详情'}
    </Button>
  ) : null;

  // 移动端详情面板样式
  const detailsPanelStyle = isMobile ? {
    marginTop: '4px',
    padding: '8px 10px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    border: '1px solid #e5e5e5',
    fontSize: '12px',
  } : {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#fafafa',
    borderRadius: '6px',
    border: '1px solid #e8e8e8',
  };

  const labelStyle = isMobile ? {
    fontSize: '12px',
    fontWeight: 600 as const,
    marginBottom: '4px',
    color: '#595959',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '4px',
  } : {
    fontSize: '13px',
    fontWeight: 600 as const,
    marginBottom: '8px',
    color: '#595959',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '6px',
  };

  return (
    <div>
      {/* 工具调用摘要（包含详情按钮）*/}
      <ToolCallSummary toolCall={toolCall} detailsButton={detailsButton} expanded={showDetails} />

      {/* 详情展开内容 - 调用中自动显示，完成后可折叠 */}
      {shouldShowDetails && (
        <div style={detailsPanelStyle}>
          {/* 移动端展开时显示描述（排除与工具名重复的描述） */}
          {isMobile && toolCall.description && toolCall.description !== `调用工具: ${toolCall.name}` && (
            <div style={{
              marginBottom: (hasArgs || toolCall.result || toolCall.error) ? '10px' : '0',
              color: '#595959',
              fontSize: '12px',
              lineHeight: 1.5,
            }}>
              {toolCall.description}
            </div>
          )}

          {/* 调用参数 - 仅当有非空参数时显示 */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <div style={{ marginBottom: toolCall.result || toolCall.error ? (isMobile ? '10px' : '16px') : '0' }}>
              <div style={labelStyle}>
                📊 调用参数
                {isCalling && (
                  <span style={{ fontSize: '12px', color: '#1890ff', fontWeight: 'normal' }}>
                    (正在执行...)
                  </span>
                )}
              </div>
              <JsonDisplay data={toolCall.args} />
            </div>
          )}

          {/* 返回结果 - 只在有结果时显示 */}
          {toolCall.result && !isCalling && (
            <div>
              <div style={labelStyle}>
                📊 返回结果
              </div>
              <JsonDisplay data={toolCall.result} />
            </div>
          )}

          {/* 错误信息 */}
          {toolCall.error && (
            <div>
              <div style={{ ...labelStyle, color: '#ff4d4f' }}>
                ❌ 错误信息
              </div>
              <div style={{
                padding: isMobile ? '6px 8px' : '8px 12px',
                backgroundColor: '#fff2f0',
                borderRadius: '4px',
                color: '#ff4d4f',
                fontSize: isMobile ? '12px' : '13px',
                fontFamily: 'Monaco, Consolas, monospace',
                wordBreak: 'break-word' as const,
              }}>
                {toolCall.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
