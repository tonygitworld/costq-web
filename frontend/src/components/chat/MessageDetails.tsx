// MessageDetails component - Display detailed information about tool calls
import { type FC, useState } from 'react';
import { Button, Divider } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { type ToolCallData } from '../../types/chat';
import { JsonDisplay } from './JsonDisplay';

interface MessageDetailsProps {
  toolCalls?: ToolCallData[];
}

export const MessageDetails: FC<MessageDetailsProps> = ({ toolCalls }) => {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="message-details">
      <Divider style={{ margin: '16px 0' }} />

      {toolCalls.map(tc => (
        <ToolCallDetails key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
};

interface ToolCallDetailsProps {
  toolCall: ToolCallData;
}

const ToolCallDetails: FC<ToolCallDetailsProps> = ({ toolCall }) => {
  return (
    <div className="tool-details-section">
      <h4 className="section-title">🔧 工具调用详情</h4>

      <div className="detail-items">
        <DetailItem label="工具名称" value={toolCall.name} />
        <DetailItem label="状态" value={toolCall.status} />
        {toolCall.duration && (
          <DetailItem label="耗时" value={`${toolCall.duration.toFixed(1)}s`} />
        )}
      </div>

      {toolCall.args && (
        <JsonBlock label="📋 调用参数" data={toolCall.args} />
      )}

      {toolCall.result && (
        <JsonBlock label="📊 返回结果" data={toolCall.result} />
      )}

      {toolCall.error && (
        <div className="error-block">
          <span className="error-label">❌ 错误信息：</span>
          <pre className="error-content">{toolCall.error}</pre>
        </div>
      )}
    </div>
  );
};

const DetailItem: FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="detail-item">
    <span className="detail-label">{label}:</span>
    <span className="detail-value">{value}</span>
  </div>
);

const JsonBlock: FC<{ label: string; data: any }> = ({ label, data }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="json-block">
      <div className="json-block-header">
        <span className="json-block-label">{label}</span>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopy}
          style={{
            fontSize: '12px',
            height: '24px'
          }}
        >
          {copied ? '✓ 已复制' : '复制'}
        </Button>
      </div>

      <div className="json-content">
        <JsonDisplay data={data} maxDepth={2} />
      </div>
    </div>
  );
};
