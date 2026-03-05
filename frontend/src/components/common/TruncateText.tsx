import { type FC, useRef, useState, useEffect } from 'react';
import { Tooltip, Modal } from 'antd';
import ReactMarkdown from 'react-markdown';

interface TruncateTextProps {
  text: string;
  /** 最大显示行数，默认 2 */
  maxLines?: number;
  /** Tooltip 最大宽度，默认 400 */
  tooltipMaxWidth?: number;
  /** 是否启用点击弹出 Modal 查看完整内容，默认 false（仅 hover Tooltip） */
  expandable?: boolean;
  /** Modal 标题 */
  modalTitle?: string;
  /** 展开链接文字（支持 i18n），默认 "展开查看" */
  expandLabel?: string;
}

/**
 * 多行文本截断组件。
 * - 默认：超出 maxLines 行时 hover 弹出 Tooltip
 * - expandable 模式：截断时显示展开链接，点击弹出 Modal 查看完整内容（支持 Markdown 渲染）
 * - 文本未截断时不弹 Tooltip，也不显示展开链接
 */
export const TruncateText: FC<TruncateTextProps> = ({
  text,
  maxLines = 2,
  tooltipMaxWidth = 400,
  expandable = false,
  modalTitle,
  expandLabel = '展开查看',
}) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setIsTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [text, maxLines]);

  const clampStyle: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    wordBreak: 'break-word',
    lineHeight: '1.5',
  };

  const clampedContent = (
    <div ref={textRef} style={clampStyle}>
      {text}
    </div>
  );

  if (!isTruncated) return clampedContent;

  if (expandable) {
    return (
      <>
        <div>
          {clampedContent}
          <a
            onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
            style={{ fontSize: 12, color: '#0972d3', cursor: 'pointer', marginTop: 2, display: 'inline-block' }}
          >
            {expandLabel}
          </a>
        </div>
        <Modal
          title={modalTitle}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={720}
        >
          <div style={{ maxHeight: '70vh', overflow: 'auto', lineHeight: '1.7' }}>
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <Tooltip
      title={<div style={{ maxWidth: tooltipMaxWidth, whiteSpace: 'pre-wrap' }}>{text}</div>}
      placement="topLeft"
      overlayStyle={{ maxWidth: tooltipMaxWidth + 32 }}
    >
      {clampedContent}
    </Tooltip>
  );
};
