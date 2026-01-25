import { useState, useEffect, useCallback } from 'react';
import { ErrorHandler, type ErrorInfo, type FallbackOptions } from '../utils/ErrorHandler';

/**
 * 错误处理Hook
 */
export const useErrorHandler = () => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [fallbackOptions, setFallbackOptions] = useState<FallbackOptions>({
    enableScrollManager: true,
    enablePositionKeeper: true,
    enableHoverEffects: true,
    enableSmoothScrolling: true,
    enablePerformanceMonitoring: true
  });

  const errorHandler = ErrorHandler.getInstance();

  // 更新错误列表和降级选项
  const updateState = useCallback(() => {
    setErrors(errorHandler.getErrors());
    setFallbackOptions(errorHandler.getFallbackOptions());
  }, [errorHandler]);

  // 监听错误变化
  useEffect(() => {
    const unsubscribe = errorHandler.onError(() => {
      updateState();
    });

    // 初始化状态
    updateState();

    return unsubscribe;
  }, [errorHandler, updateState]);

  // 手动报告错误
  const reportError = useCallback((error: Partial<ErrorInfo>) => {
    errorHandler.handleError(error);
  }, [errorHandler]);

  // 清除错误
  const clearErrors = useCallback(() => {
    errorHandler.clearErrors();
    updateState();
  }, [errorHandler, updateState]);

  // 重置降级选项
  const resetFallback = useCallback(() => {
    errorHandler.resetFallbackOptions();
    updateState();
  }, [errorHandler, updateState]);

  // 安全执行函数
  const safeExecute = useCallback(<T>(
    fn: () => T,
    fallback: T,
    component?: string,
    errorName?: string
  ): T => {
    return errorHandler.safeExecute(fn, fallback, component, errorName);
  }, [errorHandler]);

  // 安全执行异步函数
  const safeExecuteAsync = useCallback(<T>(
    fn: () => Promise<T>,
    fallback: T,
    component?: string,
    errorName?: string
  ): Promise<T> => {
    return errorHandler.safeExecuteAsync(fn, fallback, component, errorName);
  }, [errorHandler]);

  // 检查功能是否启用
  const isFeatureEnabled = useCallback((feature: keyof FallbackOptions): boolean => {
    return errorHandler.isFeatureEnabled(feature);
  }, [errorHandler]);

  // 获取错误统计
  const getErrorStats = useCallback(() => {
    return errorHandler.getErrorStats();
  }, [errorHandler]);

  return {
    errors,
    fallbackOptions,
    reportError,
    clearErrors,
    resetFallback,
    safeExecute,
    safeExecuteAsync,
    isFeatureEnabled,
    getErrorStats
  };
};
