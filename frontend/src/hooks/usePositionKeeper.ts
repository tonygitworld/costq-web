import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  PositionState,
  PositionKeeperOptions,
  PositionKeeperConfig,
  ScrollIntent,
  UserBehaviorPattern,
  PositionMemory,
  PositionKeeperEvent
} from '../types/position';
import { ErrorHandler } from '../utils/ErrorHandler';

import { logger } from '../utils/logger';

/**
 * usePositionKeeper Hook
 *
 * 功能：
 * - 检测用户主动滚动行为
 * - 管理自动滚动的时机
 * - 保持用户当前浏览位置
 * - 学习用户行为模式
 * - 智能决策自动滚动
 */

interface UsePositionKeeperProps {
  containerRef: React.RefObject<HTMLElement | null>;
  options?: Partial<PositionKeeperConfig>;
}

interface UsePositionKeeperReturn {
  positionState: PositionState;
  shouldAutoScroll: boolean;
  userBehaviorPattern: UserBehaviorPattern;
  handleUserScroll: () => void;
  forceAutoScroll: () => void;
  preventAutoScroll: () => void;
  savePosition: () => void;
  restorePosition: () => boolean;
  resetBehaviorPattern: () => void;
  getScrollIntent: () => ScrollIntent | null;
}

const DEFAULT_OPTIONS: PositionKeeperOptions = {
  autoScrollThreshold: 100,
  userScrollDetectionTime: 2000,
  preservePositionOnUpdate: true,
  fastScrollThreshold: 1000,
  enableSmartAutoScroll: true,
  debug: false
};

export const usePositionKeeper = ({
  containerRef,
  options = {}
}: UsePositionKeeperProps): UsePositionKeeperReturn => {
  const config: PositionKeeperConfig = { ...DEFAULT_OPTIONS, ...options };
  const errorHandler = ErrorHandler.getInstance();

  // 状态管理
  const [positionState, setPositionState] = useState<PositionState>({
    lastUserScroll: 0,
    isUserScrolling: false,
    shouldAutoScroll: true,
    currentScrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    scrollDirection: null,
    scrollVelocity: 0
  });

  const [userBehaviorPattern, setUserBehaviorPattern] = useState<UserBehaviorPattern>({
    scrollFrequency: 0,
    averageScrollDistance: 0,
    prefersBottom: true,
    frequentlyScrollsUp: false,
    recentPattern: 'idle'
  });

  // 内部状态引用
  const scrollHistoryRef = useRef<Array<{ timestamp: number; position: number; deltaY: number }>>([]);
  const userScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const positionMemoryRef = useRef<PositionMemory | null>(null);
  const lastScrollEventRef = useRef<number>(0);
  const scrollIntentRef = useRef<ScrollIntent | null>(null);
  const behaviorMetricsRef = useRef({
    scrollCount: 0,
    totalScrollDistance: 0,
    bottomTimeSpent: 0,
    upScrollCount: 0,
    lastActivityTime: Date.now()
  });

  /**
   * 触发事件回调
   */
  const emitEvent = useCallback((event: PositionKeeperEvent, data?: any) => {
    if (config.onEvent) {
      config.onEvent(event, data);
    }

    if (config.debug) {
      logger.debug(`[PositionKeeper] Event: ${event}`, data);
    }
  }, [config.onEvent, config.debug]);

  /**
   * 更新位置状态
   */
  const updatePositionState = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // 计算滚动速度
    const now = Date.now();
    const timeDelta = now - lastScrollEventRef.current;
    const positionDelta = scrollTop - positionState.currentScrollTop;
    const velocity = timeDelta > 0 ? Math.abs(positionDelta) / timeDelta * 1000 : 0;

    // 检测滚动方向
    const direction = positionDelta > 0 ? 'down' : positionDelta < 0 ? 'up' : null;

    // 更新滚动历史
    if (timeDelta > 0) {
      scrollHistoryRef.current.push({
        timestamp: now,
        position: scrollTop,
        deltaY: positionDelta
      });

      // 保持最近50个记录
      if (scrollHistoryRef.current.length > 50) {
        scrollHistoryRef.current.shift();
      }
    }

    const newState: PositionState = {
      ...positionState,
      currentScrollTop: scrollTop,
      scrollHeight,
      clientHeight,
      scrollDirection: direction,
      scrollVelocity: velocity
    };

    setPositionState(newState);
    lastScrollEventRef.current = now;

    if (config.onPositionChange) {
      config.onPositionChange(newState);
    }

    return newState;
  }, [containerRef, positionState, config.onPositionChange]);

  /**
   * 计算是否应该自动滚动
   */
  const calculateAutoScrollDecision = useCallback((state: PositionState): boolean => {
    if (!config.enableSmartAutoScroll) {
      // 简单模式：仅基于距离底部的位置
      const distanceFromBottom = state.scrollHeight - state.currentScrollTop - state.clientHeight;
      return distanceFromBottom <= config.autoScrollThreshold;
    }

    // 智能模式：综合考虑多个因素
    const distanceFromBottom = state.scrollHeight - state.currentScrollTop - state.clientHeight;
    const isNearBottom = distanceFromBottom <= config.autoScrollThreshold;
    const isUserScrolling = state.isUserScrolling;
    const recentUserActivity = Date.now() - state.lastUserScroll < config.userScrollDetectionTime;

    // 基础条件：用户不在主动滚动且接近底部
    if (isUserScrolling || !isNearBottom) {
      return false;
    }

    // 如果用户最近有滚动活动，需要更谨慎
    if (recentUserActivity) {
      // 如果用户最后的滚动方向是向上，可能在查看历史消息
      if (state.scrollDirection === 'up') {
        return false;
      }

      // 如果滚动速度很快，可能是在快速浏览
      if (state.scrollVelocity > config.fastScrollThreshold) {
        return false;
      }
    }

    // 基于用户行为模式的决策
    if (userBehaviorPattern.recentPattern === 'reading' && userBehaviorPattern.prefersBottom) {
      return true;
    }

    if (userBehaviorPattern.recentPattern === 'searching' || userBehaviorPattern.frequentlyScrollsUp) {
      return false;
    }

    // 默认决策
    return isNearBottom && !recentUserActivity;
  }, [config, userBehaviorPattern]);

  /**
   * 更新用户行为模式
   */
  const updateBehaviorPattern = useCallback(() => {
    const metrics = behaviorMetricsRef.current;
    const now = Date.now();
    const timeSinceLastActivity = now - metrics.lastActivityTime;

    // 计算滚动频率（次/分钟）
    const scrollFrequency = metrics.scrollCount / Math.max(1, timeSinceLastActivity / 60000);

    // 计算平均滚动距离
    const averageScrollDistance = metrics.totalScrollDistance / Math.max(1, metrics.scrollCount);

    // 判断是否偏好底部
    const prefersBottom = metrics.bottomTimeSpent > timeSinceLastActivity * 0.6;

    // 判断是否经常向上滚动
    const frequentlyScrollsUp = metrics.upScrollCount / Math.max(1, metrics.scrollCount) > 0.3;

    // 判断最近的模式
    let recentPattern: UserBehaviorPattern['recentPattern'] = 'idle';
    const recentHistory = scrollHistoryRef.current.slice(-10);

    if (recentHistory.length > 5) {
      const avgDelta = recentHistory.reduce((sum, h) => sum + Math.abs(h.deltaY), 0) / recentHistory.length;
      const upScrollRatio = recentHistory.filter(h => h.deltaY < 0).length / recentHistory.length;

      if (avgDelta < 50) {
        recentPattern = 'reading';
      } else if (upScrollRatio > 0.5) {
        recentPattern = 'searching';
      } else {
        recentPattern = 'skimming';
      }
    }

    const newPattern: UserBehaviorPattern = {
      scrollFrequency,
      averageScrollDistance,
      prefersBottom,
      frequentlyScrollsUp,
      recentPattern
    };

    setUserBehaviorPattern(newPattern);

    if (config.debug) {
      logger.debug('[PositionKeeper] Behavior pattern updated:', newPattern);
    }
  }, [config.debug]);

  /**
   * 处理用户滚动
   */
  const handleUserScroll = useCallback(() => {
    // 检查是否启用位置保持器
    if (!errorHandler.isFeatureEnabled('enablePositionKeeper')) {
      return;
    }

    errorHandler.safeExecute(
      () => {
        const now = Date.now();
        const newState = updatePositionState();

    if (!newState) return;

    // 标记用户正在滚动
    setPositionState(prev => ({
      ...prev,
      isUserScrolling: true,
      lastUserScroll: now
    }));

    // 更新行为指标
    const metrics = behaviorMetricsRef.current;
    metrics.scrollCount++;
    metrics.lastActivityTime = now;

    if (newState.scrollDirection === 'up') {
      metrics.upScrollCount++;
    }

    if (scrollHistoryRef.current.length > 1) {
      const lastScroll = scrollHistoryRef.current[scrollHistoryRef.current.length - 2];
      metrics.totalScrollDistance += Math.abs(newState.currentScrollTop - lastScroll.position);
    }

    // 检测是否在底部停留
    const distanceFromBottom = newState.scrollHeight - newState.currentScrollTop - newState.clientHeight;
    if (distanceFromBottom <= config.autoScrollThreshold) {
      metrics.bottomTimeSpent += 100; // 假设每次滚动事件间隔100ms
    }

    // 清除之前的定时器
    if (userScrollTimerRef.current) {
      clearTimeout(userScrollTimerRef.current);
    }

    // 设置用户滚动结束检测
    userScrollTimerRef.current = setTimeout(() => {
      setPositionState(prev => ({
        ...prev,
        isUserScrolling: false
      }));

      updateBehaviorPattern();
      emitEvent('user-scroll-end');
    }, config.userScrollDetectionTime);

        emitEvent('user-scroll-start', { position: newState.currentScrollTop });
      },
      undefined,
      'PositionKeeper',
      'HandleUserScrollError'
    );
  }, [updatePositionState, config.userScrollDetectionTime, config.autoScrollThreshold, updateBehaviorPattern, emitEvent, errorHandler]);

  /**
   * 强制执行自动滚动
   */
  const forceAutoScroll = useCallback(() => {
    setPositionState(prev => ({
      ...prev,
      shouldAutoScroll: true
    }));

    scrollIntentRef.current = {
      type: 'programmatic',
      confidence: 1.0,
      timestamp: Date.now()
    };

    emitEvent('auto-scroll-triggered', { forced: true });
  }, [emitEvent]);

  /**
   * 阻止自动滚动
   */
  const preventAutoScroll = useCallback(() => {
    setPositionState(prev => ({
      ...prev,
      shouldAutoScroll: false
    }));

    emitEvent('auto-scroll-prevented');
  }, [emitEvent]);

  /**
   * 保存当前位置
   */
  const savePosition = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const contentHash = container.innerHTML.length.toString(); // 简单的内容哈希

    positionMemoryRef.current = {
      savedPosition: container.scrollTop,
      savedAt: Date.now(),
      contentHash,
      isValid: true
    };

    emitEvent('position-saved', { position: container.scrollTop });
  }, [containerRef, emitEvent]);

  /**
   * 恢复保存的位置
   */
  const restorePosition = useCallback((): boolean => {
    if (!containerRef.current || !positionMemoryRef.current?.isValid) {
      return false;
    }

    const container = containerRef.current;
    const memory = positionMemoryRef.current;
    const currentContentHash = container.innerHTML.length.toString();

    // 检查内容是否发生变化
    if (memory.contentHash !== currentContentHash) {
      if (config.debug) {
        logger.debug('[PositionKeeper] Content changed, position restore skipped');
      }
      return false;
    }

    // 检查保存时间是否过期（5分钟）
    if (Date.now() - memory.savedAt > 300000) {
      if (config.debug) {
        logger.debug('[PositionKeeper] Saved position expired');
      }
      return false;
    }

    container.scrollTop = memory.savedPosition;
    emitEvent('position-restored', { position: memory.savedPosition });

    return true;
  }, [containerRef, config.debug, emitEvent]);

  /**
   * 重置行为模式
   */
  const resetBehaviorPattern = useCallback(() => {
    behaviorMetricsRef.current = {
      scrollCount: 0,
      totalScrollDistance: 0,
      bottomTimeSpent: 0,
      upScrollCount: 0,
      lastActivityTime: Date.now()
    };

    scrollHistoryRef.current = [];

    setUserBehaviorPattern({
      scrollFrequency: 0,
      averageScrollDistance: 0,
      prefersBottom: true,
      frequentlyScrollsUp: false,
      recentPattern: 'idle'
    });
  }, []);

  /**
   * 获取当前滚动意图
   */
  const getScrollIntent = useCallback((): ScrollIntent | null => {
    return scrollIntentRef.current;
  }, []);

  // 监听容器滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      handleUserScroll();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);

      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current);
      }
    };
  }, [containerRef, handleUserScroll]);

  // 计算是否应该自动滚动
  const shouldAutoScroll = calculateAutoScrollDecision(positionState);

  // 更新自动滚动决策
  useEffect(() => {
    const newShouldAutoScroll = calculateAutoScrollDecision(positionState);

    if (newShouldAutoScroll !== positionState.shouldAutoScroll) {
      setPositionState(prev => ({
        ...prev,
        shouldAutoScroll: newShouldAutoScroll
      }));

      if (config.onAutoScrollDecision) {
        config.onAutoScrollDecision(newShouldAutoScroll, 'position-change');
      }
    }
  }, [positionState, calculateAutoScrollDecision, config.onAutoScrollDecision]);

  // 定期更新行为模式
  useEffect(() => {
    const interval = setInterval(updateBehaviorPattern, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, [updateBehaviorPattern]);

  return {
    positionState,
    shouldAutoScroll,
    userBehaviorPattern,
    handleUserScroll,
    forceAutoScroll,
    preventAutoScroll,
    savePosition,
    restorePosition,
    resetBehaviorPattern,
    getScrollIntent
  };
};
