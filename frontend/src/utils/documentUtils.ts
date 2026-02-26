/**
 * 文档处理工具模块 — 验证与常量定义（Word / Markdown / Text）
 */

import { ATTACHMENT_CONSTRAINTS } from './excelUtils';

export const DOCUMENT_CONSTRAINTS = {
  ALLOWED_TYPES: [
    'application/msword',                                                          // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',      // .docx
    'text/markdown',                                                                // .md
    'text/plain',                                                                   // .txt（也作为 .md 的 fallback）
  ] as const,
  ALLOWED_EXTENSIONS: ['.doc', '.docx', '.md', '.txt'] as const,
  MAX_FILE_SIZE: 20 * 1024 * 1024,  // 20MB
  MAX_COUNT: 3,                      // 每条消息最多 3 个文档
} as const;

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
  errorType?: 'format' | 'size' | 'count' | 'total_count';
}

/**
 * 从文件名中提取扩展名（小写）
 */
function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

/**
 * 判断文件是否为允许的文档类型
 *
 * 特殊处理：.md 文件在某些浏览器/OS 上 MIME 类型报告为 text/plain，
 * 因此对 .md 扩展名的文件，只要 MIME 是 text/plain 或 text/markdown 均视为有效。
 */
function isValidDocumentFile(file: File): boolean {
  const extension = getFileExtension(file.name);

  const isValidExtension = DOCUMENT_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(
    extension as (typeof DOCUMENT_CONSTRAINTS.ALLOWED_EXTENSIONS)[number],
  );
  if (!isValidExtension) return false;

  // .md 文件特殊处理：允许 text/markdown 或 text/plain
  if (extension === '.md') {
    return file.type === 'text/markdown' || file.type === 'text/plain' || file.type === '';
  }

  // .txt 文件
  if (extension === '.txt') {
    return file.type === 'text/plain' || file.type === '';
  }

  // .doc / .docx：严格检查 MIME 类型
  const isValidType = DOCUMENT_CONSTRAINTS.ALLOWED_TYPES.includes(
    file.type as (typeof DOCUMENT_CONSTRAINTS.ALLOWED_TYPES)[number],
  );
  return isValidType;
}

/**
 * 验证文档文件的格式、大小、数量和附件总数
 *
 * 验证顺序：格式验证（MIME 类型 + 文件扩展名双重检查）→ 大小验证（≤20MB）
 *          → 文档数量验证（≤3）→ 附件总数验证（图片+Excel+文档 ≤8）
 */
export function validateDocumentFile(
  file: File,
  currentDocumentCount: number,
  currentImageCount: number,
  currentExcelCount: number,
  maxDocumentCount: number = DOCUMENT_CONSTRAINTS.MAX_COUNT,
  maxTotalCount: number = ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT,
): DocumentValidationResult {
  // 1. 格式验证
  if (!isValidDocumentFile(file)) {
    return {
      valid: false,
      error: '仅支持 .doc、.docx、.md 和 .txt 格式的文档文件',
      errorType: 'format',
    };
  }

  // 2. 大小验证
  if (file.size > DOCUMENT_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: '文档文件大小不能超过 20MB',
      errorType: 'size',
    };
  }

  // 3. 文档数量验证
  if (currentDocumentCount + 1 > maxDocumentCount) {
    return {
      valid: false,
      error: `每条消息最多附加 ${maxDocumentCount} 个文档文件`,
      errorType: 'count',
    };
  }

  // 4. 附件总数验证（图片 + Excel + 文档）
  if (currentImageCount + currentExcelCount + currentDocumentCount + 1 > maxTotalCount) {
    return {
      valid: false,
      error: `每条消息最多附加 ${maxTotalCount} 个附件`,
      errorType: 'total_count',
    };
  }

  return { valid: true };
}

/**
 * 根据 MIME 类型和文件扩展名判断文档子类型
 * 用于 UI 展示时区分图标和颜色
 */
export function getDocumentType(mimeType: string, fileName: string): 'word' | 'markdown' | 'text' {
  const extension = getFileExtension(fileName);

  if (extension === '.doc' || extension === '.docx') return 'word';
  if (extension === '.md') return 'markdown';
  if (extension === '.txt') return 'text';

  // fallback: 根据 MIME 类型判断
  if (mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'word';
  }
  if (mimeType === 'text/markdown') return 'markdown';

  return 'text';
}

/**
 * 判断文件是否为文档类型（用于 MessageInput 文件分流）
 */
export function isDocumentFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  return DOCUMENT_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(
    extension as (typeof DOCUMENT_CONSTRAINTS.ALLOWED_EXTENSIONS)[number],
  );
}
