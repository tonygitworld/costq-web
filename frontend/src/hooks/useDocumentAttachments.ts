/**
 * 文档附件生命周期管理 Hook（Word / Markdown / Text）
 *
 * 封装文档附件的添加、删除、清空逻辑。
 * 附件是临时的、与单次发送绑定的局部状态。
 * 与 useExcelAttachments 模式一致，文档附件无需预览 URL 和内存释放。
 */

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import type { DocumentAttachment } from '../types/chat';
import {
  validateDocumentFile,
  DOCUMENT_CONSTRAINTS,
} from '../utils/documentUtils';
import { ATTACHMENT_CONSTRAINTS } from '../utils/excelUtils';
import { fileToBase64 } from '../utils/imageUtils';
import { useI18n } from './useI18n';

export interface UseDocumentAttachmentsReturn {
  attachments: DocumentAttachment[];
  addDocumentFiles: (files: File[], currentImageCount: number, currentExcelCount: number) => Promise<void>;
  removeDocument: (id: string) => void;
  clearAttachments: () => void;
  isProcessing: boolean;
}

export function useDocumentAttachments(
  maxDocumentCount: number = DOCUMENT_CONSTRAINTS.MAX_COUNT,
  maxTotalCount: number = ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT,
): UseDocumentAttachmentsReturn {
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useI18n('chat');

  // useRef to track current attachments, avoiding stale closures
  const attachmentsRef = useRef<DocumentAttachment[]>(attachments);
  attachmentsRef.current = attachments;

  const addDocumentFiles = useCallback(
    async (files: File[], currentImageCount: number, currentExcelCount: number) => {
      if (files.length === 0) return;

      setIsProcessing(true);

      try {
        const newAttachments: DocumentAttachment[] = [];
        let currentDocumentCount = attachmentsRef.current.length;

        for (const file of files) {
          const result = validateDocumentFile(
            file,
            currentDocumentCount,
            currentImageCount,
            currentExcelCount,
            maxDocumentCount,
            maxTotalCount,
          );

          if (!result.valid) {
            const errorMessages: Record<string, string> = {
              format: t('attachment.documentFormatError'),
              size: t('attachment.documentSizeError'),
              count: t('attachment.documentCountError', { maxCount: maxDocumentCount }),
              total_count: t('attachment.totalCountError', { maxCount: maxTotalCount }),
            };
            const msg = (result.errorType && errorMessages[result.errorType]) || result.error || '';
            message.warning(msg);
            // 数量超限时，跳过剩余所有文件
            if (result.errorType === 'count' || result.errorType === 'total_count') {
              break;
            }
            continue;
          }

          const base64Data = await fileToBase64(file);

          newAttachments.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            base64Data,
          });

          currentDocumentCount++;
        }

        if (newAttachments.length > 0) {
          setAttachments((prev) => [...prev, ...newAttachments]);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [maxDocumentCount, maxTotalCount, t],
  );

  const removeDocument = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    addDocumentFiles,
    removeDocument,
    clearAttachments,
    isProcessing,
  };
}
