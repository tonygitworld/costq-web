import { type FC } from 'react';
import { FileExcelOutlined } from '@ant-design/icons';
import type { ExcelAttachment } from '../../types/chat';
import styles from './MessageExcelList.module.css';

interface MessageExcelListProps {
  attachments: ExcelAttachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MessageExcelList: FC<MessageExcelListProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={styles.excelList}>
      {attachments.map((att) => (
        <div key={att.id} className={styles.excelCard}>
          <FileExcelOutlined className={styles.excelIcon} />
          <div className={styles.excelInfo}>
            <span className={styles.excelFileName} title={att.fileName}>
              {att.fileName}
            </span>
            <span className={styles.excelFileSize}>
              {formatFileSize(att.fileSize)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageExcelList;
