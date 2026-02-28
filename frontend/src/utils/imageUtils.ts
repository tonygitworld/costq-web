/**
 * 图片处理工具模块 — 验证、压缩与编码
 */

import { logger } from './logger';

export const IMAGE_CONSTRAINTS = {
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  MAX_FILE_SIZE: 10 * 1024 * 1024,        // 10MB
  MAX_COUNT: 5,
  COMPRESS_THRESHOLD: 1 * 1024 * 1024,    // 1MB
  COMPRESS_MAX_DIMENSION: 2048,
  COMPRESS_QUALITY: 0.8,
} as const;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorType?: 'format' | 'size' | 'count' | 'corrupt';
}

/**
 * 验证图片文件的格式、大小、数量和完整性
 */
export async function validateImage(
  file: File,
  currentCount: number,
  maxCount: number = IMAGE_CONSTRAINTS.MAX_COUNT,
): Promise<ValidationResult> {
  // 1. 格式验证
  if (
    !IMAGE_CONSTRAINTS.ALLOWED_TYPES.includes(
      file.type as (typeof IMAGE_CONSTRAINTS.ALLOWED_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: '仅支持 JPEG、PNG、GIF、WebP 格式',
      errorType: 'format',
    };
  }

  // 2. 大小验证
  if (file.size > IMAGE_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: '图片大小不能超过 10MB',
      errorType: 'size',
    };
  }

  // 3. 数量验证
  if (currentCount + 1 > maxCount) {
    return {
      valid: false,
      error: `每条消息最多附加 ${maxCount} 张图片`,
      errorType: 'count',
    };
  }

  // 4. 文件完整性验证 — 尝试加载为 Image 对象
  try {
    await loadImageFromFile(file);
  } catch {
    return {
      valid: false,
      error: '该文件无法作为图片加载',
      errorType: 'corrupt',
    };
  }

  return { valid: true };
}

/**
 * 将文件加载为 Image 对象，用于验证文件完整性
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// compressImage — 图片客户端压缩
// ---------------------------------------------------------------------------

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * 检测 PNG 图片是否包含透明通道。
 * 通过将图片绘制到 canvas 上并检查像素 alpha 值来判断。
 */
function hasTransparency(img: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 每 4 个值为一组 (R, G, B, A)，检查 alpha 通道
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * 压缩图片文件。
 *
 * - 文件 ≤ COMPRESS_THRESHOLD (1 MB) 或 GIF 格式：直接返回原始文件
 * - 超过阈值时：缩放至长边 ≤ maxDimension (默认 2048)，
 *   透明 PNG 输出为 PNG，其余输出为 JPEG (quality 默认 0.8)
 * - 压缩失败时降级返回原始文件并记录警告
 */
export async function compressImage(
  file: File,
  options?: CompressOptions,
): Promise<File> {
  const maxDimension = options?.maxDimension ?? IMAGE_CONSTRAINTS.COMPRESS_MAX_DIMENSION;
  const quality = options?.quality ?? IMAGE_CONSTRAINTS.COMPRESS_QUALITY;

  // GIF 格式跳过压缩
  if (file.type === 'image/gif') {
    return file;
  }

  // 小于阈值不压缩
  if (file.size <= IMAGE_CONSTRAINTS.COMPRESS_THRESHOLD) {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);

    const { naturalWidth: origW, naturalHeight: origH } = img;
    const longest = Math.max(origW, origH);

    // 计算缩放后的尺寸，保持宽高比
    let targetW = origW;
    let targetH = origH;
    if (longest > maxDimension) {
      const scale = maxDimension / longest;
      targetW = Math.round(origW * scale);
      targetH = Math.round(origH * scale);
    }

    // 绘制到 canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logger.warn('[compressImage] Canvas 2D context 不可用，返回原始文件');
      return file;
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // 确定输出格式
    const isPngWithAlpha = file.type === 'image/png' && hasTransparency(img);
    const outputType = isPngWithAlpha ? 'image/png' : 'image/jpeg';

    // 使用 toBlob 生成压缩后的文件
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? quality : undefined);
    });

    if (!blob) {
      logger.warn('[compressImage] canvas.toBlob 返回 null，返回原始文件');
      return file;
    }

    // 构造新的 File 对象，保留原始文件名（调整扩展名）
    const ext = outputType === 'image/png' ? '.png' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}${ext}`, { type: outputType });
  } catch (error) {
    logger.warn('[compressImage] 压缩失败，返回原始文件:', error);
    return file;
  }
}

// ---------------------------------------------------------------------------
// fileToBase64 — 文件转 Base64 编码
// ---------------------------------------------------------------------------

/**
 * 将文件转换为 Base64 编码字符串（含 data URI 前缀）
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
