/**
 * CollapsibleDescription - 可折叠描述组件
 * 支持 Markdown 检测和纯文本，折叠/展开切换
 */
import React, { useState } from 'react';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** markdown 组件映射 - 卡片内紧凑样式 */
const mdComponents = {
  h1: ({ children }: any) => <div style={{ fontWeight: 600, fontSize: 13, color: '#344054', margin: '2px 0' }}>{children}</div>,
  h2: ({ children }: any) => <div style={{ fontWeight: 600, fontSize: 13, color: '#344054', margin: '2px 0' }}>{children}</div>,
  h3: ({ children }: any) => <div style={{ fontWeight: 600, fontSize: 13, color: '#344054', margin: '2px 0' }}>{children}</div>,
  h4: ({ children }: any) => <div style={{ fontWeight: 600, fontSize: 12, color: '#344054', margin: '2px 0' }}>{children}</div>,
  h5: ({ children }: any) => <div style={{ fontWeight: 600, fontSize: 12, color: '#344054', margin: '2px 0' }}>{children}</div>,
  h6: ({ children }: any) => <div style={{ fontWeight: 600, fontSize: 12, color: '#344054', margin: '2px 0' }}>{children}</div>,
  p: ({ children }: any) => <div style={{ margin: '1px 0' }}>{children}</div>,
  ul: ({ children }: any) => <ul style={{ margin: '2px 0', paddingLeft: 16 }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ margin: '2px 0', paddingLeft: 16 }}>{children}</ol>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1570ef' }}>{children}</a>,
};

export const hasMdSyntax = (text: string) => /^#{1,6}\s|^\*\*|^\- |\n#{1,6}\s|\n\- /.test(text);

const extractPlainPreview = (text: string, maxLen = 50): string => {
  const plain = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + '…' : plain;
};

const ToggleLink: React.FC<{ expanded: boolean; onClick: () => void }> = ({ expanded, onClick }) => (
  <button
    onClick={onClick}
    type="button"
    aria-expanded={expanded}
    style={{
      background: 'none',
      border: 'none',
      padding: 0,
      color: '#1570ef',
      fontSize: 12,
      cursor: 'pointer',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    {expanded ? (<>收起 <UpOutlined style={{ fontSize: 9 }} /></>) : (<>展开 <DownOutlined style={{ fontSize: 9 }} /></>)}
  </button>
);


export const CollapsibleDescription: React.FC<{ text: string }> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return <span style={{ color: '#667085', fontSize: 12 }}>-</span>;

  const isMd = hasMdSyntax(text);
  const isShort = !isMd && text.length <= 50;

  if (isShort) {
    return <span style={{ color: '#667085', fontSize: 12, lineHeight: 1.5 }}>{text}</span>;
  }

  return (
    <div style={{ fontSize: 12 }}>
      {!expanded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            color: '#667085',
            lineHeight: 1.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}>
            {extractPlainPreview(text)}
          </span>
          <ToggleLink expanded={false} onClick={() => setExpanded(true)} />
        </div>
      ) : (
        <div>
          <div style={{
            color: '#344054',
            lineHeight: 1.6,
            background: '#f9fafb',
            borderRadius: 6,
            padding: '8px 10px',
            border: '1px solid #eaecf0',
          }}>
            {isMd ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</ReactMarkdown>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <ToggleLink expanded={true} onClick={() => setExpanded(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
