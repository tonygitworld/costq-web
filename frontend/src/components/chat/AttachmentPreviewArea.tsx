import { type FC } from 'react';
import { Image } from 'antd';
import { CloseCircleFilled, FileExcelOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImageAttachment, ExcelAttachment } from '../../types/chat';
import styles from './AttachmentPreviewArea.module.css';

interface AttachmentPreviewAreaProps {
  imageAttachments: ImageAttachment[];
  excelAttachments: ExcelAttachment[];
  onRemoveImage: (id: string) => void;
  onRemoveExcel: (id: string) => void;
}

/**
 * 格式化文件大小为人类可读格式
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const itemAnimation = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: { duration: 0.2 },
};

export const AttachmentPreviewArea: FC<AttachmentPreviewAreaProps> = ({
  imageAttachments,
  excelAttachments,
  onRemoveImage,
  onRemoveExcel,
}) => {
  if (imageAttachments.length === 0 && excelAttachments.length === 0) return null;

  return (
    <div className={styles.attachmentPreviewArea}>
      {/* Image thumbnails */}
      {imageAttachments.length > 0 && (
        <Image.PreviewGroup>
          <AnimatePresence>
            {imageAttachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                className={styles.imagePreviewItem}
                {...itemAnimation}
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
                  className={styles.removeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(attachment.id);
                  }}
                  aria-label={`删除 ${attachment.fileName}`}
                >
                  <CloseCircleFilled />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </Image.PreviewGroup>
      )}

      {/* Excel file cards */}
      <AnimatePresence>
        {excelAttachments.map((attachment) => (
          <motion.div
            key={attachment.id}
            className={styles.excelPreviewCard}
            {...itemAnimation}
          >
            <FileExcelOutlined className={styles.excelIcon} />
            <div className={styles.excelInfo}>
              <span className={styles.excelFileName} title={attachment.fileName}>
                {attachment.fileName}
              </span>
              <span className={styles.excelFileSize}>
                {formatFileSize(attachment.fileSize)}
              </span>
            </div>
            <button
              className={styles.removeBtn}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveExcel(attachment.id);
              }}
              aria-label={`删除 ${attachment.fileName}`}
            >
              <CloseCircleFilled />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
