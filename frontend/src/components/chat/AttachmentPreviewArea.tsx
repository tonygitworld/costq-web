import { type FC } from 'react';
import { Image } from 'antd';
import { CloseCircleFilled, FileExcelOutlined, FileWordOutlined, FileMarkdownOutlined, FileTextOutlined, FilePdfOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { Attachment } from '../../utils/attachmentConstraints';
import { formatSize } from '../../utils/attachmentConstraints';
import styles from './AttachmentPreviewArea.module.css';

interface AttachmentPreviewAreaProps {
  /** 附件列表 */
  attachments: Attachment[];
  /** 删除回调 */
  onRemove: (id: string) => void;
}

const itemAnimation = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: { duration: 0.2 },
};

/**
 * 根据文档子类型返回对应的图标组件
 */
function getDocumentIcon(docType: 'pdf' | 'word' | 'markdown' | 'text') {
  switch (docType) {
    case 'pdf':
      return <FilePdfOutlined className={styles.documentIcon} style={{ color: '#ff4d4f' }} />;
    case 'word':
      return <FileWordOutlined className={styles.documentIcon} style={{ color: '#2b579a' }} />;
    case 'markdown':
      return <FileMarkdownOutlined className={styles.documentIcon} style={{ color: '#333333' }} />;
    case 'text':
      return <FileTextOutlined className={styles.documentIcon} style={{ color: '#666666' }} />;
  }
}

/**
 * 根据 MIME 类型和文件名判断文档子类型
 */
function getDocumentType(mimeType: string, fileName: string): 'pdf' | 'word' | 'markdown' | 'text' {
  const extension = fileName.toLowerCase().split('.').pop();

  if (extension === 'pdf') return 'pdf';
  if (extension === 'doc' || extension === 'docx') return 'word';
  if (extension === 'md') return 'markdown';
  if (extension === 'txt') return 'text';

  // fallback: 根据 MIME 类型判断
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'word';
  }
  if (mimeType === 'text/markdown') return 'markdown';

  return 'text';
}

/**
 * 图片附件项
 */
const ImageAttachmentItem: FC<{
  attachment: Attachment & { type: 'image' };
  onRemove: () => void;
}> = ({ attachment, onRemove }) => (
  <motion.div
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
        onRemove();
      }}
      aria-label={`删除 ${attachment.fileName}`}
    >
      <CloseCircleFilled />
    </button>
  </motion.div>
);

/**
 * Excel 附件项
 */
const ExcelAttachmentItem: FC<{
  attachment: Attachment & { type: 'excel' };
  onRemove: () => void;
}> = ({ attachment, onRemove }) => (
  <motion.div
    className={styles.excelPreviewCard}
    {...itemAnimation}
  >
    <FileExcelOutlined className={styles.excelIcon} />
    <div className={styles.excelInfo}>
      <span className={styles.excelFileName} title={attachment.fileName}>
        {attachment.fileName}
      </span>
      <span className={styles.excelFileSize}>
        {formatSize(attachment.fileSize)}
      </span>
    </div>
    <button
      className={styles.removeBtn}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={`删除 ${attachment.fileName}`}
    >
      <CloseCircleFilled />
    </button>
  </motion.div>
);

/**
 * 文档附件项
 */
const DocumentAttachmentItem: FC<{
  attachment: Attachment & { type: 'document' };
  onRemove: () => void;
}> = ({ attachment, onRemove }) => {
  const docType = getDocumentType(attachment.mimeType, attachment.fileName);
  const icon = getDocumentIcon(docType);

  return (
    <motion.div
      className={styles.documentPreviewCard}
      {...itemAnimation}
    >
      {icon}
      <div className={styles.documentInfo}>
        <span className={styles.documentFileName} title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className={styles.documentFileSize}>
          {formatSize(attachment.fileSize)}
        </span>
      </div>
      <button
        className={styles.removeBtn}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`删除 ${attachment.fileName}`}
      >
        <CloseCircleFilled />
      </button>
    </motion.div>
  );
};

/**
 * 附件预览区域组件
 *
 * 统一显示图片、Excel、文档附件
 * 最多显示 3 个附件
 */
export const AttachmentPreviewArea: FC<AttachmentPreviewAreaProps> = ({
  attachments,
  onRemove,
}) => {
  // 如果没有附件，不渲染
  if (attachments.length === 0) {
    return null;
  }

  // 分离不同类型的附件用于分组显示
  const imageAttachments = attachments.filter((a): a is Attachment & { type: 'image' } => a.type === 'image');
  const excelAttachments = attachments.filter((a): a is Attachment & { type: 'excel' } => a.type === 'excel');
  const documentAttachments = attachments.filter((a): a is Attachment & { type: 'document' } => a.type === 'document');

  return (
    <div className={styles.attachmentPreviewArea}>
      <AnimatePresence>
        {/* 图片附件预览 */}
        {imageAttachments.length > 0 && (
          <Image.PreviewGroup>
            {imageAttachments.map((attachment) => (
              <ImageAttachmentItem
                key={attachment.id}
                attachment={attachment}
                onRemove={() => onRemove(attachment.id)}
              />
            ))}
          </Image.PreviewGroup>
        )}

        {/* Excel 附件预览 */}
        {excelAttachments.map((attachment) => (
          <ExcelAttachmentItem
            key={attachment.id}
            attachment={attachment}
            onRemove={() => onRemove(attachment.id)}
          />
        ))}

        {/* 文档附件预览 */}
        {documentAttachments.map((attachment) => (
          <DocumentAttachmentItem
            key={attachment.id}
            attachment={attachment}
            onRemove={() => onRemove(attachment.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
