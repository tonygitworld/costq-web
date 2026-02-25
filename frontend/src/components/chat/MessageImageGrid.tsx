// MessageImageGrid - 消息中的图片网格展示组件
import { type FC } from 'react';
import { Image, Skeleton } from 'antd';
import { type ImageAttachment } from '../../types/chat';

interface MessageImageGridProps {
  attachments: ImageAttachment[];
}

const MessageImageGrid: FC<MessageImageGridProps> = ({ attachments }) => {
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
          {attachments.map((att) => (
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
          ))}
        </div>
      </Image.PreviewGroup>
    </div>
  );
};

export default MessageImageGrid;
