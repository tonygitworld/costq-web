// JsonDisplay component - Display JSON data with formatting
import { type FC, useMemo } from 'react';

interface JsonDisplayProps {
  data: any;
  maxDepth?: number;
}

/**
 * 智能解析数据，自动处理嵌套的 JSON 字符串
 */
function parseNestedJson(data: any): any {
  // null 或 undefined
  if (data == null) {
    return data;
  }

  // 字符串类型 - 尝试解析为 JSON
  if (typeof data === 'string') {
    // 去除首尾空白
    const trimmed = data.trim();

    // 检查是否像 JSON（以 { 或 [ 开头）
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
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
    const result: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = parseNestedJson(data[key]);
      }
    }
    return result;
  }

  // 其他类型（数字、布尔等）
  return data;
}

export const JsonDisplay: FC<JsonDisplayProps> = ({ data }) => {
  // 智能解析数据（自动处理嵌套的 JSON 字符串）
  const parsedData = useMemo(() => parseNestedJson(data), [data]);

  // 格式化 JSON
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(parsedData, null, 2);
    } catch (error) {
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
