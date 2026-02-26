/**
 * 附件约束配置 - 统一文件上传限制
 *
 * 规范:
 * - 最多 3 个附件
 * - 总大小不超过 20MB
 * - 支持图片、Excel、文档类型
 */

import type { ImageAttachment, ExcelAttachment, DocumentAttachment } from '../types/chat';

/**
 * 统一附件类型
 */
export type Attachment =
  | (ImageAttachment & { type: 'image' })
  | (ExcelAttachment & { type: 'excel' })
  | (DocumentAttachment & { type: 'document' });

/**
 * 附件约束常量
 */
export const ATTACHMENT_CONSTRAINTS = {
  /** 最大附件数量 */
  MAX_TOTAL_COUNT: 3,
  /** 最大总大小（字节） */
  MAX_TOTAL_SIZE: 20 * 1024 * 1024, // 20MB

  /** 允许的文件类型 */
  ALLOWED_TYPES: {
    /** 图片类型 */
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
    /** Excel 类型 */
    EXCEL: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ] as const,
    /** 文档类型 */
    DOCUMENT: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/plain',
    ] as const,
  },

  /** 图片压缩阈值 */
  IMAGE_COMPRESS_THRESHOLD: 1 * 1024 * 1024, // 1MB
  /** 图片压缩质量 */
  IMAGE_COMPRESS_QUALITY: 0.8,
  /** 图片最大尺寸 */
  IMAGE_MAX_DIMENSION: 2048,
} as const;

/**
 * 验证结果类型
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorType?: 'count' | 'total_size' | 'single_size' | 'type';
}

/**
 * 计算附件总大小
 * @param attachments 附件列表
 * @returns 总字节数
 */
export function calculateTotalSize(attachments: Attachment[]): number {
  return attachments.reduce((sum, attachment) => sum + attachment.fileSize, 0);
}

/**
 * 格式化文件大小为人类可读格式
 * @param bytes 字节数
 * @returns 格式化后的字符串（如 "5.2MB"）
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 检查文件类型是否允许
 * @param mimeType MIME 类型
 * @returns 是否允许
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allAllowedTypes = [
    ...ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.IMAGE,
    ...ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.EXCEL,
    ...ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.DOCUMENT,
  ];
  return allAllowedTypes.includes(mimeType as typeof allAllowedTypes[number]);
}

/**
 * 获取文件类型分类
 * @param mimeType MIME 类型
 * @returns 类型分类
 */
export function getFileCategory(mimeType: string): 'image' | 'excel' | 'document' | 'unknown' {
  if (ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.IMAGE.includes(mimeType as typeof ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.IMAGE[number])) {
    return 'image';
  }
  if (ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.EXCEL.includes(mimeType as typeof ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.EXCEL[number])) {
    return 'excel';
  }
  if (ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.DOCUMENT.includes(mimeType as typeof ATTACHMENT_CONSTRAINTS.ALLOWED_TYPES.DOCUMENT[number])) {
    return 'document';
  }
  return 'unknown';
}
