/**
 * Excel 处理工具模块 — 验证与常量定义
 */

export const EXCEL_CONSTRAINTS = {
  ALLOWED_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel',                                          // .xls
  ] as const,
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls'] as const,
  MAX_FILE_SIZE: 20 * 1024 * 1024,  // 20MB
  MAX_COUNT: 3,
} as const;

export const ATTACHMENT_CONSTRAINTS = {
  MAX_TOTAL_COUNT: 3,  // 图片 + Excel + 文档 总数上限
} as const;

export interface ExcelValidationResult {
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
 * 验证 Excel 文件的格式、大小、数量和附件总数
 *
 * 验证顺序：格式验证（MIME 类型 + 文件扩展名双重检查）→ 大小验证（≤20MB）
 *          → Excel 数量验证（≤3）→ 附件总数验证（图片+Excel+文档 ≤3）
 */
export function validateExcelFile(
  file: File,
  currentExcelCount: number,
  currentImageCount: number,
  currentDocumentCount: number = 0,
  maxExcelCount: number = EXCEL_CONSTRAINTS.MAX_COUNT,
  maxTotalCount: number = ATTACHMENT_CONSTRAINTS.MAX_TOTAL_COUNT,
): ExcelValidationResult {
  // 1. 格式验证 — MIME 类型 + 文件扩展名双重检查
  const isValidType = EXCEL_CONSTRAINTS.ALLOWED_TYPES.includes(
    file.type as (typeof EXCEL_CONSTRAINTS.ALLOWED_TYPES)[number],
  );
  const extension = getFileExtension(file.name);
  const isValidExtension = EXCEL_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(
    extension as (typeof EXCEL_CONSTRAINTS.ALLOWED_EXTENSIONS)[number],
  );

  if (!isValidType || !isValidExtension) {
    return {
      valid: false,
      error: '仅支持 .xlsx 和 .xls 格式的 Excel 文件',
      errorType: 'format',
    };
  }

  // 2. 大小验证
  if (file.size > EXCEL_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Excel 文件大小不能超过 20MB',
      errorType: 'size',
    };
  }

  // 3. Excel 数量验证
  if (currentExcelCount + 1 > maxExcelCount) {
    return {
      valid: false,
      error: `每条消息最多附加 ${maxExcelCount} 个 Excel 文件`,
      errorType: 'count',
    };
  }

  // 4. 附件总数验证（图片 + Excel + 文档）
  if (currentExcelCount + currentImageCount + currentDocumentCount + 1 > maxTotalCount) {
    return {
      valid: false,
      error: `每条消息最多附加 ${maxTotalCount} 个附件`,
      errorType: 'total_count',
    };
  }

  return { valid: true };
}
