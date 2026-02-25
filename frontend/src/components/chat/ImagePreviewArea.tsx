import { type FC } from 'react';
import { Image } from 'antd';
import { CloseCircleFilled } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImageAttachment } from '../../types/chat';
import './ImagePreviewArea.css';

interface ImagePreviewAreaProps {
  attachments: ImageAttachment[];
  onRemove: (id: string) => void;
}

export const ImagePreviewArea: FC<ImagePreviewAreaProps> = ({ attachments, onRemove }) => {
  if (attachments.length === 0) return null;

  return (
    <div className="image-preview-area">
      <Image.PreviewGroup>
        <AnimatePresence>
          {attachments.map((attachment) => (
            <motion.div
              key={attachment.id}
              className="image-preview-item"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src={attachment.previewUrl}
                alt={attachment.fileName}
                width={64}
                height={64}
                style={{ objectFit: 'cover', borderRadius: 8 }}
                preview={{ src: attachment.previewUrl }}
              />
              <button
                className="image-preview-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(attachment.id);
                }}
                aria-label={`删除 ${attachment.fileName}`}
              >
                <CloseCircleFilled />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </Image.PreviewGroup>
    </div>
  );
};
