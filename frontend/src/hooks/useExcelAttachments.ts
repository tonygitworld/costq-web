/**
 * Excel 附件生命周期管理 Hook
 *
 * 封装 Excel 附件的添加、删除、清空逻辑。
 * 附件是临时的、与单次发送绑定的局部状态。
 * 与 useImageAttachments 不同，Excel 附件无需预览 URL 和内存释放。
 */

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import type { ExcelAttachment } from '../types/chat';
import {
  validateExcelFile,
  EXCEL_CONSTRAINTS,
  ATTACHMENT_CONSTRAINTS,
} from '../utils/excelUtils';
import { fileToBase64 } from '../utils/imageUtils';

export interface UseExcelAttachmentsReturn {
  attachments: ExcelAttachment[];
  addExcelFiles: (files: File[], currentImageCount: number) => Promise<void>;
  removeExcel: (id: string) => void;
  clearAttachments: () => void;
  isProcessing: boolean;
}

export function useExcelAttachments(
  maxExcelCount: number = EXCEL_CONSTRAINTS.MAX_COUNT,
  maxTotalCount: number = ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT,
): UseExcelAttachmentsReturn {
  const [attachments, setAttachments] = useState<ExcelAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // useRef to track current attachments, avoiding stale closures
  const attachmentsRef = useRef<ExcelAttachment[]>(attachments);
  attachmentsRef.current = attachments;

  const addExcelFiles = useCallback(
    async (files: File[], currentImageCount: number) => {
      if (files.length === 0) return;

      setIsProcessing(true);

      try {
        const newAttachments: ExcelAttachment[] = [];
        let currentExcelCount = attachmentsRef.current.length;

        for (const file of files) {
          const result = validateExcelFile(
            file,
            currentExcelCount,
            currentImageCount,
            maxExcelCount,
            maxTotalCount,
          );

          if (!result.valid) {
            message.warning(result.error);
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

          currentExcelCount++;
        }

        if (newAttachments.length > 0) {
          setAttachments((prev) => [...prev, ...newAttachments]);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [maxExcelCount, maxTotalCount],
  );

  const removeExcel = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    addExcelFiles,
    removeExcel,
    clearAttachments,
    isProcessing,
  };
}
