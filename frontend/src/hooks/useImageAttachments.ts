/**
 * 图片附件生命周期管理 Hook
 *
 * 封装图片附件的添加、删除、清空和内存释放逻辑。
 * 附件是临时的、与单次发送绑定的局部状态。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import type { ImageAttachment } from '../types/chat';
import {
  validateImage,
  compressImage,
  fileToBase64,
  IMAGE_CONSTRAINTS,
} from '../utils/imageUtils';

export interface UseImageAttachmentsReturn {
  attachments: ImageAttachment[];
  addImages: (files: FileList | File[]) => Promise<void>;
  removeImage: (id: string) => void;
  clearAttachments: () => void;
  isProcessing: boolean;
}

export function useImageAttachments(
  maxCount: number = IMAGE_CONSTRAINTS.MAX_COUNT,
): UseImageAttachmentsReturn {
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // useRef to track current attachments for cleanup, avoiding stale closures
  const attachmentsRef = useRef<ImageAttachment[]>(attachments);
  attachmentsRef.current = attachments;

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsProcessing(true);

      try {
        const newAttachments: ImageAttachment[] = [];
        let currentCount = attachmentsRef.current.length;

        for (const file of fileArray) {
          const result = await validateImage(file, currentCount, maxCount);

          if (!result.valid) {
            if (result.errorType === 'corrupt') {
              message.error(result.error);
            } else {
              message.warning(result.error);
            }
            // 数量超限时，跳过剩余所有文件
            if (result.errorType === 'count') {
              break;
            }
            continue;
          }

          const compressed = await compressImage(file);
          const base64Data = await fileToBase64(compressed);
          const previewUrl = URL.createObjectURL(compressed);

          newAttachments.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            fileSize: compressed.size,
            mimeType: compressed.type,
            previewUrl,
            base64Data,
          });

          currentCount++;
        }

        if (newAttachments.length > 0) {
          setAttachments((prev) => [...prev, ...newAttachments]);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [maxCount],
  );

  const removeImage = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const attachment of prev) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return [];
    });
  }, []);

  // Cleanup on unmount: revoke all preview URLs
  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, []);

  return {
    attachments,
    addImages,
    removeImage,
    clearAttachments,
    isProcessing,
  };
}
