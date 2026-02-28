import { type FC } from 'react';
import { FileWordOutlined, FileMarkdownOutlined, FileTextOutlined } from '@ant-design/icons';
import type { DocumentAttachment } from '../../types/chat';
import { getDocumentType } from '../../utils/documentUtils';
import styles from './MessageDocumentList.module.css';

interface MessageDocumentListProps {
  attachments: DocumentAttachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIcon(docType: 'word' | 'markdown' | 'text') {
  switch (docType) {
    case 'word':
      return <FileWordOutlined className={styles.documentIcon} style={{ color: '#2b579a' }} />;
    case 'markdown':
      return <FileMarkdownOutlined className={styles.documentIcon} style={{ color: '#333333' }} />;
    case 'text':
      return <FileTextOutlined className={styles.documentIcon} style={{ color: '#666666' }} />;
  }
}

export const MessageDocumentList: FC<MessageDocumentListProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={styles.documentList}>
      {attachments.map((att) => {
        const docType = getDocumentType(att.mimeType, att.fileName);
        return (
          <div key={att.id} className={styles.documentCard}>
            {getIcon(docType)}
            <div className={styles.documentInfo}>
              <span className={styles.documentFileName} title={att.fileName}>
                {att.fileName}
              </span>
              <span className={styles.documentFileSize}>
                {formatFileSize(att.fileSize)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
