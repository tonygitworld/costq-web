/**
 * 位置保持管理相关的类型定义
 */

export interface PositionState {
  /**
   * 最后一次用户主动滚动的时间戳
   */
  lastUserScroll: number;

  /**
   * 用户是否正在主动滚动
   */
  isUserScrolling: boolean;

  /**
   * 是否应该执行自动滚动
   */
  shouldAutoScroll: boolean;

  /**
   * 当前滚动位置
   */
  currentScrollTop: number;

  /**
   * 滚动容器的高度信息
   */
  scrollHeight: number;
  clientHeight: number;

  /**
   * 滚动方向
   */
  scrollDirection: 'up' | 'down' | null;

  /**
   * 滚动速度（px/s）
   */
  scrollVelocity: number;
}

export interface PositionKeeperOptions {
  /**
   * 自动滚动阈值距离（距离底部多少像素内认为用户想要自动滚动）
   */
  autoScrollThreshold: number;

  /**
   * 用户滚动检测时间窗口（毫秒）
   * 在此时间内的滚动被认为是用户主动行为
   */
  userScrollDetectionTime: number;

  /**
   * 是否在内容更新时保持位置
   */
  preservePositionOnUpdate: boolean;

  /**
   * 滚动速度阈值，超过此速度认为是快速滚动
   */
  fastScrollThreshold: number;

  /**
   * 是否启用智能自动滚动
   * 智能模式会根据用户行为模式决定是否自动滚动
   */
  enableSmartAutoScroll: boolean;

  /**
   * 调试模式
   */
  debug: boolean;
}

export interface ScrollIntent {
  /**
   * 滚动意图类型
   */
  type: 'user' | 'auto' | 'programmatic';

  /**
   * 意图强度（0-1）
   */
  confidence: number;

  /**
   * 触发时间
   */
  timestamp: number;

  /**
   * 相关的滚动距离
   */
  deltaY?: number;

  /**
   * 滚动目标位置
   */
  targetPosition?: number;
}

export interface UserBehaviorPattern {
  /**
   * 用户滚动频率（次/分钟）
   */
  scrollFrequency: number;

  /**
   * 平均滚动距离
   */
  averageScrollDistance: number;

  /**
   * 用户是否倾向于停留在底部
   */
  prefersBottom: boolean;

  /**
   * 用户是否经常回滚查看历史
   */
  frequentlyScrollsUp: boolean;

  /**
   * 最近的滚动模式
   */
  recentPattern: 'reading' | 'skimming' | 'searching' | 'idle';
}

export interface PositionMemory {
  /**
   * 保存的滚动位置
   */
  savedPosition: number;

  /**
   * 保存时间
   */
  savedAt: number;

  /**
   * 内容标识（用于检测内容是否变化）
   */
  contentHash: string;

  /**
   * 是否有效
   */
  isValid: boolean;
}

/**
 * 位置保持事件类型
 */
export type PositionKeeperEvent =
  | 'user-scroll-start'
  | 'user-scroll-end'
  | 'auto-scroll-triggered'
  | 'auto-scroll-prevented'
  | 'position-saved'
  | 'position-restored'
  | 'content-updated';

/**
 * 事件回调函数类型
 */
export type PositionKeeperEventCallback = (
  event: PositionKeeperEvent,
  data?: unknown
) => void;

/**
 * 位置保持配置
 */
export interface PositionKeeperConfig extends PositionKeeperOptions {
  /**
   * 事件回调
   */
  onEvent?: PositionKeeperEventCallback;

  /**
   * 位置变化回调
   */
  onPositionChange?: (position: PositionState) => void;

  /**
   * 自动滚动决策回调
   */
  onAutoScrollDecision?: (shouldScroll: boolean, reason: string) => void;
}
