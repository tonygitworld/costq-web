// MessageImageGrid - 消息中的图片网格展示组件
import { type FC } from 'react';
import { Image, Skeleton } from 'antd';
import { FileImageOutlined } from '@ant-design/icons';
import { type ImageAttachment } from '../../types/chat';

interface MessageImageGridProps {
  attachments: ImageAttachment[];
}

/**
 * 图片占位符组件
 * 当图片没有 base64 数据时显示（页面刷新后从数据库加载的情况）
 * 样式与 MessageDocumentList 保持一致
 */
const ImagePlaceholder: FC<{ fileName: string }> = ({ fileName }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: '#f5f5f5',
        border: '1px solid #e8e8e8',
        maxWidth: '280px',
      }}
    >
      <FileImageOutlined style={{ fontSize: '24px', color: '#666666', flexShrink: 0 }} />
      <span
        style={{
          fontSize: '13px',
          color: 'rgba(0, 0, 0, 0.85)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}
        title={fileName}
      >
        {fileName}
      </span>
    </div>
  );
};

export const MessageImageGrid: FC<MessageImageGridProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null;

  const isSingle = attachments.length === 1;

  return (
    <div style={{ marginTop: 8 }}>
      <Image.PreviewGroup>
        <div
          style={
            isSingle
              ? {}
              : {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, 120px)',
                  gap: 8,
                }
          }
        >
          {attachments.map((att) => {
            // 检查是否有 base64 数据（页面刷新后从数据库加载的消息可能没有）
            const hasBase64Data = att.base64Data && att.base64Data.startsWith('data:');

            if (!hasBase64Data) {
              // 没有 base64 数据，显示占位符
              return <ImagePlaceholder key={att.id} fileName={att.fileName} />;
            }

            return (
              <Image
                key={att.id}
                src={att.base64Data}
                alt={att.fileName}
                width={isSingle ? undefined : 120}
                height={isSingle ? undefined : 120}
                style={
                  isSingle
                    ? { maxWidth: 300, borderRadius: 8 }
                    : { objectFit: 'cover', borderRadius: 8 }
                }
                placeholder={
                  <Skeleton.Image
                    active
                    style={{
                      width: isSingle ? 300 : 120,
                      height: isSingle ? 200 : 120,
                    }}
                  />
                }
              />
            );
          })}
        </div>
      </Image.PreviewGroup>
    </div>
  );
};
