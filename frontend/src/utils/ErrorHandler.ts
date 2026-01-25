/**
 * 错误处理和降级方案管理器
 */

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  timestamp: number;
  component?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface FallbackOptions {
  enableScrollManager: boolean;
  enablePositionKeeper: boolean;
  enableHoverEffects: boolean;
  enableSmoothScrolling: boolean;
  enablePerformanceMonitoring: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: ErrorInfo[] = [];
  private fallbackOptions: FallbackOptions;
  private maxErrors = 50;
  private errorCallbacks: ((error: ErrorInfo) => void)[] = [];

  private constructor() {
    this.fallbackOptions = {
      enableScrollManager: true,
      enablePositionKeeper: true,
      enableHoverEffects: true,
      enableSmoothScrolling: true,
      enablePerformanceMonitoring: true
    };

    this.setupGlobalErrorHandlers();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 捕获未处理的Promise错误
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        name: 'UnhandledPromiseRejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: Date.now(),
        severity: 'high',
        recoverable: true
      });
    });

    // 捕获JavaScript错误
    window.addEventListener('error', (event) => {
      this.handleError({
        name: event.error?.name || 'JavaScriptError',
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
        severity: 'high',
        recoverable: false
      });
    });
  }

  /**
   * 处理错误
   */
  public handleError(error: Partial<ErrorInfo>): void {
    const fullError: ErrorInfo = {
      name: error.name || 'UnknownError',
      message: error.message || 'Unknown error occurred',
      stack: error.stack,
      timestamp: error.timestamp || Date.now(),
      component: error.component,
      severity: error.severity || 'medium',
      recoverable: error.recoverable ?? true
    };

    // 添加到错误列表
    this.errors.push(fullError);

    // 保持错误列表大小
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // 根据错误严重程度决定降级策略
    this.applyFallbackStrategy(fullError);

    // 通知错误回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(fullError);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });

    // 记录错误
    this.logError(fullError);
  }

  /**
   * 应用降级策略
   */
  private applyFallbackStrategy(error: ErrorInfo): void {
    switch (error.severity) {
      case 'critical':
        // 关键错误：禁用所有高级功能
        this.fallbackOptions = {
          enableScrollManager: false,
          enablePositionKeeper: false,
          enableHoverEffects: false,
          enableSmoothScrolling: false,
          enablePerformanceMonitoring: false
        };
        break;

      case 'high':
        // 高级错误：禁用相关组件
        if (error.component === 'ScrollManager') {
          this.fallbackOptions.enableScrollManager = false;
        } else if (error.component === 'PositionKeeper') {
          this.fallbackOptions.enablePositionKeeper = false;
        } else if (error.component === 'HoverStableCard') {
          this.fallbackOptions.enableHoverEffects = false;
        }
        break;

      case 'medium':
        // 中级错误：禁用性能监控
        if (error.component === 'PerformanceMonitor') {
          this.fallbackOptions.enablePerformanceMonitoring = false;
        }
        break;

      case 'low':
        // 低级错误：仅记录，不降级
        break;
    }
  }

  /**
   * 记录错误
   */
  private logError(error: ErrorInfo): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.component || 'Unknown'}] ${error.name}: ${error.message}`;

    switch (logLevel) {
      case 'error':
        console.error(logMessage, error.stack);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * 获取日志级别
   */
  private getLogLevel(severity: ErrorInfo['severity']): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'log';
    }
  }

  /**
   * 获取降级选项
   */
  public getFallbackOptions(): FallbackOptions {
    return { ...this.fallbackOptions };
  }

  /**
   * 手动设置降级选项
   */
  public setFallbackOptions(options: Partial<FallbackOptions>): void {
    this.fallbackOptions = { ...this.fallbackOptions, ...options };
  }

  /**
   * 重置降级选项
   */
  public resetFallbackOptions(): void {
    this.fallbackOptions = {
      enableScrollManager: true,
      enablePositionKeeper: true,
      enableHoverEffects: true,
      enableSmoothScrolling: true,
      enablePerformanceMonitoring: true
    };
  }

  /**
   * 获取错误列表
   */
  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  /**
   * 清除错误列表
   */
  public clearErrors(): void {
    this.errors = [];
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorInfo['severity'], number>;
    byComponent: Record<string, number>;
    recent: ErrorInfo[];
  } {
    const bySeverity: Record<ErrorInfo['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    const byComponent: Record<string, number> = {};

    this.errors.forEach(error => {
      bySeverity[error.severity]++;

      const component = error.component || 'Unknown';
      byComponent[component] = (byComponent[component] || 0) + 1;
    });

    // 最近5分钟的错误
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recent = this.errors.filter(error => error.timestamp > fiveMinutesAgo);

    return {
      total: this.errors.length,
      bySeverity,
      byComponent,
      recent
    };
  }

  /**
   * 添加错误回调
   */
  public onError(callback: (error: ErrorInfo) => void): () => void {
    this.errorCallbacks.push(callback);

    // 返回取消订阅函数
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 检查功能是否可用
   */
  public isFeatureEnabled(feature: keyof FallbackOptions): boolean {
    return this.fallbackOptions[feature];
  }

  /**
   * 安全执行函数
   */
  public safeExecute<T>(
    fn: () => T,
    fallback: T,
    component?: string,
    errorName?: string
  ): T {
    try {
      return fn();
    } catch (error) {
      this.handleError({
        name: errorName || 'SafeExecuteError',
        message: error instanceof Error ? error.message : 'Unknown error in safe execute',
        stack: error instanceof Error ? error.stack : undefined,
        component,
        severity: 'medium',
        recoverable: true
      });

      return fallback;
    }
  }

  /**
   * 安全执行异步函数
   */
  public async safeExecuteAsync<T>(
    fn: () => Promise<T>,
    fallback: T,
    component?: string,
    errorName?: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handleError({
        name: errorName || 'SafeExecuteAsyncError',
        message: error instanceof Error ? error.message : 'Unknown error in safe execute async',
        stack: error instanceof Error ? error.stack : undefined,
        component,
        severity: 'medium',
        recoverable: true
      });

      return fallback;
    }
  }

  /**
   * 创建错误边界HOC（需要在React组件中使用）
   */
  public createErrorBoundaryConfig(
    componentName?: string
  ) {
    return {
      getDerivedStateFromError: (error: Error): { hasError: boolean; error: ErrorInfo } => {
        const errorInfo: ErrorInfo = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          timestamp: Date.now(),
          component: componentName,
          severity: 'high',
          recoverable: true
        };

        ErrorHandler.getInstance().handleError(errorInfo);

        return { hasError: true, error: errorInfo };
      },

      componentDidCatch: (error: Error, errorInfo: any) => {
        ErrorHandler.getInstance().handleError({
          name: error.name,
          message: error.message,
          stack: error.stack + '\n' + (errorInfo.componentStack || ''),
          component: componentName,
          severity: 'high',
          recoverable: true
        });
      },

      renderFallback: (error: ErrorInfo) => ({
        type: 'div',
        props: {
          style: {
            padding: '16px',
            border: '1px solid #ff4d4f',
            borderRadius: '4px',
            backgroundColor: '#fff2f0',
            color: '#a8071a'
          },
          children: [
            { type: 'h3', props: { children: '组件错误' } },
            {
              type: 'p',
              props: {
                children: `组件 ${componentName || 'Unknown'} 发生错误，已切换到安全模式。`
              }
            },
            {
              type: 'details',
              props: {
                children: [
                  { type: 'summary', props: { children: '错误详情' } },
                  {
                    type: 'pre',
                    props: {
                      style: { fontSize: '12px', marginTop: '8px' },
                      children: error.message
                    }
                  }
                ]
              }
            }
          ]
        }
      })
    };
  }
}
