/**
 * 滚动管理相关的类型定义
 */

export interface ScrollState {
  messageScrollTop: number;
  messageScrollHeight: number;
  messageClientHeight: number;
  outerScrollTop: number;
  outerScrollHeight: number;
  outerClientHeight: number;
  lastScrollTime: number;
  scrollDirection: 'up' | 'down' | null;
}

export interface ScrollBoundary {
  element: HTMLElement;
  canScrollUp: boolean;
  canScrollDown: boolean;
  isAtTop: boolean;
  isAtBottom: boolean;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScrollManagerConfig {
  messageContainer: HTMLElement;
  outerContainer: HTMLElement;
  smoothTransition: boolean;
  scrollThreshold: number;
  transitionDelay: number;
  enableDebugLog: boolean;
}

export interface ScrollEvent {
  deltaY: number;
  deltaX: number;
  target: HTMLElement;
  currentTarget: HTMLElement;
  timestamp: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export interface ScrollTransition {
  from: 'message' | 'outer';
  to: 'message' | 'outer';
  direction: 'up' | 'down';
  smooth: boolean;
  timestamp: number;
}

export type ScrollEventHandler = (event: WheelEvent) => void;
export type ScrollStateChangeCallback = (state: ScrollState) => void;
export type ScrollTransitionCallback = (transition: ScrollTransition) => void;

/**
 * 滚动管理器选项
 */
export interface ScrollManagerOptions {
  /**
   * 滚动阈值，用于判断是否需要切换滚动目标
   */
  threshold?: number;

  /**
   * 是否启用平滑过渡
   */
  smoothTransition?: boolean;

  /**
   * 过渡延迟时间（毫秒）
   */
  transitionDelay?: number;

  /**
   * 是否启用调试日志
   */
  debug?: boolean;

  /**
   * 滚动状态变化回调
   */
  onStateChange?: ScrollStateChangeCallback;

  /**
   * 滚动切换回调
   */
  onTransition?: ScrollTransitionCallback;
}

/**
 * 滚动性能指标
 */
export interface ScrollPerformanceMetrics {
  eventCount: number;
  averageProcessingTime: number;
  lastEventTime: number;
  transitionCount: number;
  smoothScrollCount: number;
  frameDropCount: number;
}
