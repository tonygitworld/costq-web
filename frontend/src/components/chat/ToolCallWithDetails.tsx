// ToolCallWithDetails component - Tool call with collapsible details
import { type FC, useState } from 'react';
import { Button } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { type ToolCallData } from '../../types/chat';
import { ToolCallSummary } from './ToolCallSummary';
import { JsonDisplay } from './JsonDisplay';

interface ToolCallWithDetailsProps {
  toolCall: ToolCallData;
}

export const ToolCallWithDetails: FC<ToolCallWithDetailsProps> = ({ toolCall }) => {
  // ✨ 调用中时自动展开，完成后可折叠
  const [showDetails, setShowDetails] = useState(false);
  const isCalling = toolCall.status === 'calling';

  // ✅ 修复：检查是否真的有内容（空对象不算有内容）
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;
  const hasDetails = hasArgs || toolCall.result || toolCall.error;

  // 🔧 修改：不自动展开，只有用户点击时才显示详情
  const shouldShowDetails = hasDetails && showDetails;

  // 详情按钮（只在完成后显示）
  const detailsButton = hasDetails && !isCalling ? (
    <Button
      type="text"
      size="small"
      onClick={() => setShowDetails(!showDetails)}
      icon={showDetails ? <UpOutlined /> : <DownOutlined />}
      style={{
        fontSize: '12px',
        color: '#667eea',
        height: '24px',
        padding: '0 8px'
      }}
    >
      详情
    </Button>
  ) : null;

  return (
    <div>
      {/* 工具调用摘要（包含详情按钮）*/}
      <ToolCallSummary toolCall={toolCall} detailsButton={detailsButton} />

      {/* 详情展开内容 - 调用中自动显示，完成后可折叠 */}
      {shouldShowDetails && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e8e8e8'
        }}>
          {/* 调用参数 - 仅当有非空参数时显示 */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <div style={{ marginBottom: toolCall.result || toolCall.error ? '16px' : '0' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '8px',
                color: '#595959',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                📊 调用参数
                {isCalling && (
                  <span style={{
                    fontSize: '12px',
                    color: '#1890ff',
                    fontWeight: 'normal'
                  }}>
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
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '8px',
                color: '#595959'
              }}>
                📊 返回结果
              </div>
              <JsonDisplay data={toolCall.result} />
            </div>
          )}

          {/* 错误信息 */}
          {toolCall.error && (
            <div>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '8px',
                color: '#ff4d4f'
              }}>
                ❌ 错误信息
              </div>
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#fff2f0',
                borderRadius: '4px',
                color: '#ff4d4f',
                fontSize: '13px',
                fontFamily: 'Monaco, Consolas, monospace'
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
