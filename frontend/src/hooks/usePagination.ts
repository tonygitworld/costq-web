/**
 * usePagination Hook - 表格分页状态管理
 *
 * @description
 * 统一管理 Ant Design Table 分页状态，避免重复代码
 *
 * @param defaultPageSize - 默认每页显示数量（默认10）
 * @returns 分页状态和配置对象
 *
 * @example
 * const { currentPage, pageSize, paginationProps } = usePagination(10);
 *
 * <Table
 *   dataSource={data}
 *   pagination={{
 *     ...paginationProps,
 *     total: data.length,
 *     showTotal: (total) => `共 ${total} 条`
 *   }}
 * />
 */

import { useState } from 'react';

export interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  paginationProps: {
    current: number;
    pageSize: number;
    showSizeChanger: boolean;
    onChange: (page: number, newPageSize: number) => void;
  };
  resetPagination: () => void;
}

export const usePagination = (defaultPageSize: number = 10): UsePaginationReturn => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // 处理分页变化的回调函数
  const handleChange = (page: number, newPageSize: number) => {
    // 优化：避免双重 setState，pageSize 改变时直接重置到第一页
    if (newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1);
    } else {
      setCurrentPage(page);
    }
  };

  // 重置分页到初始状态
  const resetPagination = () => {
    setCurrentPage(1);
    setPageSize(defaultPageSize);
  };

  return {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    paginationProps: {
      current: currentPage,
      pageSize,
      showSizeChanger: true,
      onChange: handleChange,
    },
    resetPagination,
  };
};
