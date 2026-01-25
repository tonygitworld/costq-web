/**
 * Hover相关的类型定义
 */

export interface HoverState {
  isHovered: boolean;
  hoverStartTime: number;
  element: HTMLElement | null;
}

export interface HoverStableOptions {
  /**
   * 是否禁用hover效果
   */
  disabled?: boolean;

  /**
   * 自定义hover样式
   */
  hoverStyle?: React.CSSProperties;

  /**
   * 自定义hover类名
   */
  hoverClassName?: string;

  /**
   * hover延迟时间（毫秒）
   */
  hoverDelay?: number;

  /**
   * 是否使用GPU加速
   */
  useGPUAcceleration?: boolean;
}

export interface HoverMetrics {
  /**
   * hover开始时间
   */
  startTime: number;

  /**
   * hover持续时间
   */
  duration: number;

  /**
   * 是否触发了重排
   */
  causedReflow: boolean;

  /**
   * 性能指标
   */
  performanceEntry?: PerformanceEntry;
}

/**
 * Hover事件处理器类型
 */
export type HoverEventHandler = (event: React.MouseEvent<HTMLElement>) => void;

/**
 * Hover状态变化回调
 */
export type HoverStateChangeCallback = (isHovered: boolean, metrics?: HoverMetrics) => void;

/**
 * Hover配置接口
 */
export interface HoverConfig {
  /**
   * 是否启用性能监控
   */
  enablePerformanceMonitoring?: boolean;

  /**
   * 是否启用调试模式
   */
  debugMode?: boolean;

  /**
   * 全局hover延迟
   */
  globalHoverDelay?: number;

  /**
   * 是否在移动设备上禁用hover
   */
  disableOnMobile?: boolean;
}
