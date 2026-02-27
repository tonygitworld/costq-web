/**
 * 统一附件管理 Hook
 *
 * 功能:
 * - 统一管理图片、Excel、文档附件
 * - 统一验证数量和总大小限制
 * - 自动图片压缩
 * - 资源自动释放
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { message } from 'antd';
import { useI18n } from './useI18n';
import { logger } from '../utils/logger';
import {
  ATTACHMENT_CONSTRAINTS,
  calculateTotalSize,
  getFileCategory,
  isAllowedFileType,
  type Attachment,
  type ValidationResult,
} from '../utils/attachmentConstraints';
import { compressImage, fileToBase64 } from '../utils/imageUtils';

/**
 * useAttachments 返回值类型
 */
export interface UseAttachmentsReturn {
  /** 附件列表 */
  attachments: Attachment[];
  /** 当前总大小（字节） */
  totalSize: number;
  /** 剩余可添加数量 */
  remainingCount: number;
  /** 剩余可用大小（字节） */
  remainingSize: number;
  /** 是否还能添加更多 */
  canAddMore: boolean;
  /** 是否处理中 */
  isProcessing: boolean;

  /**
   * 添加文件
   * @param files 文件列表
   */
  addFiles: (files: FileList | File[]) => Promise<void>;

  /**
   * 删除附件
   * @param id 附件ID
   */
  removeAttachment: (id: string) => void;

  /**
   * 清空所有附件
   */
  clearAttachments: () => void;
}

/**
 * 统一附件管理 Hook
 * @returns UseAttachmentsReturn
 */
export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useI18n('chat');

  // 使用 ref 避免闭包问题
  const attachmentsRef = useRef<Attachment[]>(attachments);
  attachmentsRef.current = attachments;

  // 计算派生状态
  const totalSize = useMemo(() => calculateTotalSize(attachments), [attachments]);

  const remainingCount = useMemo(
    () => Math.max(0, ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT - attachments.length),
    [attachments.length]
  );

  const remainingSize = useMemo(
    () => Math.max(0, ATTACHMENT_CONSTRAINTS.MAX_TOTAL_SIZE - totalSize),
    [totalSize]
  );

  const canAddMore = useMemo(
    () => remainingCount > 0 && remainingSize > 0,
    [remainingCount, remainingSize]
  );

  /**
   * 验证文件是否可以添加
   */
  const validateFiles = useCallback(
    (files: File[]): ValidationResult => {
      const currentCount = attachmentsRef.current.length;
      const currentSize = calculateTotalSize(attachmentsRef.current);

      // 1. 数量检查
      if (currentCount + files.length > ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT) {
        return {
          valid: false,
          error: t('attachment.countExceeded', {
            max: ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT,
          }),
          errorType: 'count',
        };
      }

      // 2. 新增文件总大小检查
      const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);
      if (currentSize + newFilesSize > ATTACHMENT_CONSTRAINTS.MAX_TOTAL_SIZE) {
        return {
          valid: false,
          error: t('attachment.totalSizeExceeded', {
            max: '30MB',
          }),
          errorType: 'total_size',
        };
      }

      // 3. 单个文件类型检查
      for (const file of files) {
        if (!isAllowedFileType(file.type, file.name)) {
          return {
            valid: false,
            error: t('attachment.typeNotAllowed', { fileName: file.name }),
            errorType: 'type',
          };
        }
      }

      return { valid: true };
    },
    [t]
  );

  /**
   * 根据文件扩展名推断 MIME 类型
   * 用于浏览器返回空 MIME 类型的情况（如 .md 文件）
   */
  function inferMimeType(fileName: string, browserMimeType: string): string {
    // 如果浏览器返回了有效的 MIME 类型，直接使用
    if (browserMimeType && browserMimeType !== '') {
      return browserMimeType;
    }

    // 根据扩展名推断 MIME 类型
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypeMap: Record<string, string> = {
      // 图片
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      // Excel
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      // 文档
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'md': 'text/markdown',
      'markdown': 'text/markdown',
      'txt': 'text/plain',
    };

    return mimeTypeMap[ext || ''] || browserMimeType || 'application/octet-stream';
  }

  /**
   * 处理单个文件
   */
  const processFile = useCallback(
    async (file: File): Promise<Attachment | null> => {
      // 推断正确的 MIME 类型（处理浏览器返回空 type 的情况）
      const mimeType = inferMimeType(file.name, file.type);
      const category = getFileCategory(mimeType, file.name);

      try {
        if (category === 'image') {
          // 图片：压缩 + base64
          const compressed = await compressImage(file);
          const base64Data = await fileToBase64(compressed);
          const previewUrl = URL.createObjectURL(compressed);

          return {
            id: crypto.randomUUID(),
            type: 'image',
            fileName: file.name,
            fileSize: compressed.size,
            mimeType: compressed.type,
            previewUrl,
            base64Data,
          };
        }

        if (category === 'excel' || category === 'document') {
          // Excel/文档：直接转 base64
          const base64Data = await fileToBase64(file);

          return {
            id: crypto.randomUUID(),
            type: category,
            fileName: file.name,
            fileSize: file.size,
            mimeType: mimeType, // 使用推断的 MIME 类型
            base64Data,
          };
        }

        // 未知类型
        logger.warn('[useAttachments] 未知文件类型:', file.type, '推断为:', mimeType);
        return null;
      } catch (error) {
        logger.error('[useAttachments] 处理文件失败:', error);
        return null;
      }
    },
    []
  );

  /**
   * 添加文件
   */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return;
      }

      // 前置验证
      const validation = validateFiles(fileArray);
      if (!validation.valid) {
        message.error(validation.error);
        return;
      }

      setIsProcessing(true);
      try {
        const newAttachments: Attachment[] = [];

        for (const file of fileArray) {
          const attachment = await processFile(file);
          if (attachment) {
            newAttachments.push(attachment);
          }
        }

        if (newAttachments.length > 0) {
          setAttachments((prev) => [...prev, ...newAttachments]);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [validateFiles, processFile]
  );

  /**
   * 删除附件
   */
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      // 释放图片预览 URL
      if (target?.type === 'image' && 'previewUrl' in target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  /**
   * 清空所有附件
   */
  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      // 释放所有图片预览 URL
      prev.forEach((attachment) => {
        if (attachment.type === 'image' && 'previewUrl' in attachment) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      return [];
    });
  }, []);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      // 释放所有图片预览 URL
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.type === 'image' && 'previewUrl' in attachment) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  return {
    attachments,
    totalSize,
    remainingCount,
    remainingSize,
    canAddMore,
    isProcessing,
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}
