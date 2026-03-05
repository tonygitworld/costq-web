import { useState, useCallback, useMemo, useRef } from 'react';
import type { ColumnsType } from 'antd/es/table';

const DEFAULT_MIN_WIDTH = 50;
const STORAGE_PREFIX = 'table-col-widths-';
const FINGERPRINT_PREFIX = 'table-col-fp-';

/** 根据列定义生成指纹，列 key/width 变化时自动失效旧缓存 */
function columnsFingerprint<T>(columns: ColumnsType<T>): string {
  return columns.map(col => {
    const key = (col as any).key || (col as any).dataIndex || '';
    const w = (col as any).width || 0;
    return `${key}:${w}`;
  }).join('|');
}

function loadWidths<T>(tableId: string, columns: ColumnsType<T>): Record<string, number> {
  try {
    const fp = columnsFingerprint(columns);
    const savedFp = localStorage.getItem(`${FINGERPRINT_PREFIX}${tableId}`);
    if (savedFp !== fp) {
      localStorage.removeItem(`${STORAGE_PREFIX}${tableId}`);
      localStorage.setItem(`${FINGERPRINT_PREFIX}${tableId}`, fp);
      return {};
    }
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWidths(tableId: string, widths: Record<string, number>) {
  localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(widths));
}

function getDefaultWidth(col: any): number {
  const w = col.width;
  return typeof w === 'number' ? w : 150;
}

export function useColumnResize<T>(
  columns: ColumnsType<T>,
  tableId: string,
  enabled = true,
  containerWidth = 0
) {
  // Hook 1: useState — 每列的绝对宽度（用户拖拽后的值 或 初始化计算的值）
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(tableId, columns));
  // Hook 2: useRef — 追踪是否已完成初始化
  const initializedRef = useRef(false);

  // Hook 3: useMemo
  const minWidthMap = useMemo(() => {
    const map: Record<string, number> = {};
    columns.forEach(col => {
      const key = (col as any).key || (col as any).dataIndex;
      if (key && (col as any).minWidth) {
        map[key] = (col as any).minWidth;
      }
    });
    return map;
  }, [columns]);

  // Hook 4: useCallback
  const handleResize = useCallback(
    (key: string) => (_: React.SyntheticEvent, { size }: { size: { width: number } }) => {
      const min = minWidthMap[key] || DEFAULT_MIN_WIDTH;
      const w = Math.max(size.width, min);
      setWidths(prev => {
        const next = { ...prev, [key]: w };
        saveWidths(tableId, next);
        return next;
      });
    },
    [tableId, minWidthMap]
  );

  // ---- 一次性初始化 ----
  // 当容器宽度首次可用且无用户保存宽度时，按比例分配宽度填满容器，
  // 然后将结果写入 widths state。之后拖拽只改单列，不再重新分配。
  if (enabled && containerWidth > 0 && !initializedRef.current) {
    const hasUserWidths = Object.keys(widths).length > 0;
    if (hasUserWidths) {
      initializedRef.current = true;
    } else {
      // 计算默认总宽
      let defaultTotal = 0;
      let nonFixedTotal = 0;
      columns.forEach(col => {
        const w = getDefaultWidth(col);
        defaultTotal += w;
        if (!(col as any).fixed) nonFixedTotal += w;
      });

      const extra = containerWidth > defaultTotal ? containerWidth - defaultTotal : 0;
      const initW: Record<string, number> = {};
      columns.forEach(col => {
        const key = (col as any).key || (col as any).dataIndex;
        if (!key) return;
        const baseW = getDefaultWidth(col);
        const isFixed = !!(col as any).fixed;
        // 按比例分配额外空间给非 fixed 列
        if (extra > 0 && !isFixed && nonFixedTotal > 0) {
          initW[key] = Math.round(baseW + (baseW / nonFixedTotal) * extra);
        } else {
          initW[key] = baseW;
        }
      });
      initializedRef.current = true;
      setWidths(initW);
      saveWidths(tableId, initW);
    }
  }

  // Hook 5: useMemo — 构建最终列
  // 最后一个非 fixed 列作为弹性列：当总宽 < 容器宽度时吸收差值，确保表格填满。
  // 弹性列的额外宽度不存入 widths（不持久化），只在渲染时动态补偿。
  // 拖拽其他列时只有弹性列宽度变化，其余列完全不变。
  const resizedColumns = useMemo(() => {
    if (!enabled) return columns;

    // 找到最后一个非 fixed 列的 key 作为弹性列
    let flexKey: string | null = null;
    for (let i = columns.length - 1; i >= 0; i--) {
      if (!(columns[i] as any).fixed) {
        flexKey = (columns[i] as any).key || (columns[i] as any).dataIndex || null;
        break;
      }
    }

    // 先算出所有列的基础宽度总和
    let baseTotal = 0;
    columns.forEach(col => {
      const key = (col as any).key || (col as any).dataIndex;
      if (!key) return;
      baseTotal += widths[key] || getDefaultWidth(col);
    });

    // 弹性列需要吸收的差值（仅当总宽 < 容器宽度时）
    const deficit = containerWidth > 0 && baseTotal < containerWidth
      ? containerWidth - baseTotal
      : 0;

    return columns.map(col => {
      const key = (col as any).key || (col as any).dataIndex;
      if (!key) return col;
      let effectiveWidth = widths[key] || getDefaultWidth(col);
      // 弹性列吸收差值
      if (key === flexKey && deficit > 0) {
        effectiveWidth += deficit;
      }
      return {
        ...col,
        width: effectiveWidth,
        onHeaderCell: (_column: any) => ({
          width: effectiveWidth,
          onResize: handleResize(key),
        }),
      };
    });
  }, [columns, widths, enabled, handleResize, containerWidth]);

  // Hook 6: useMemo — 总宽
  const totalWidth = useMemo(() => {
    return resizedColumns.reduce((sum, col) => {
      const w = (col as any).width;
      return sum + (typeof w === 'number' ? w : 0);
    }, 0);
  }, [resizedColumns]);

  return { resizedColumns, totalWidth };
}
