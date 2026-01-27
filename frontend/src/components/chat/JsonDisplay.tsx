// JsonDisplay component - Display JSON data with formatting
import { type FC, useMemo } from 'react';

// JSON 值类型定义
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface JsonDisplayProps {
  data: unknown;
  maxDepth?: number;
}

/**
 * 智能解析数据，自动处理嵌套的 JSON 字符串
 */
function parseNestedJson(data: unknown): JsonValue {
  // null 或 undefined
  if (data == null) {
    return null;
  }

  // 字符串类型 - 尝试解析为 JSON
  if (typeof data === 'string') {
    // 去除首尾空白
    const trimmed = data.trim();

    // 检查是否像 JSON（以 { 或 [ 开头）
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        // 递归解析嵌套的 JSON
        return parseNestedJson(parsed);
      } catch {
        // 不是有效的 JSON，返回原始字符串
        return data;
      }
    }
    return data;
  }

  // 数组类型 - 递归解析每个元素
  if (Array.isArray(data)) {
    return data.map(item => parseNestedJson(item));
  }

  // 对象类型 - 递归解析每个属性
  if (typeof data === 'object') {
    const result: { [key: string]: JsonValue } = {};
    const obj = data as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = parseNestedJson(obj[key]);
      }
    }
    return result;
  }

  // 数字或布尔类型
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // 其他类型，转为字符串
  return String(data);
}

export const JsonDisplay: FC<JsonDisplayProps> = ({ data }) => {
  // 智能解析数据（自动处理嵌套的 JSON 字符串）
  const parsedData = useMemo(() => parseNestedJson(data), [data]);

  // 格式化 JSON
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(parsedData, null, 2);
    } catch {
      // 如果格式化失败，返回原始数据的字符串形式
      return String(parsedData);
    }
  }, [parsedData]);

  return (
    <div className="json-display">
      <pre style={{
        fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
        fontSize: '13px',
        lineHeight: '1.6',
        margin: 0,
        padding: 0,
        color: '#24292e',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {formattedJson}
      </pre>
    </div>
  );
};
