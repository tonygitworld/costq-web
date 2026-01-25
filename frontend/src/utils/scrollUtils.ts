/**
 * 滚动相关的工具函数
 */

import type { ScrollBoundary } from '../types/scroll';

/**
 * 检查元素是否可以滚动
 */
export const canElementScroll = (element: HTMLElement): boolean => {
  return element.scrollHeight > element.clientHeight;
};

/**
 * 检查元素是否在顶部
 */
export const isElementAtTop = (element: HTMLElement, threshold: number = 5): boolean => {
  return element.scrollTop <= threshold;
};

/**
 * 检查元素是否在底部
 */
export const isElementAtBottom = (element: HTMLElement, threshold: number = 5): boolean => {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
};

/**
 * 获取元素的滚动百分比
 */
export const getScrollPercentage = (element: HTMLElement): number => {
  if (!canElementScroll(element)) {
    return 0;
  }

  const scrollableHeight = element.scrollHeight - element.clientHeight;
  return (element.scrollTop / scrollableHeight) * 100;
};

/**
 * 平滑滚动到指定位置
 */
export const smoothScrollTo = (
  element: HTMLElement,
  targetScrollTop: number,
  duration: number = 300
): Promise<void> => {
  return new Promise((resolve) => {
    const startScrollTop = element.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用easeOutCubic缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      element.scrollTop = startScrollTop + distance * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animateScroll);
  });
};

/**
 * 滚动到元素顶部
 */
export const scrollToTop = (element: HTMLElement, smooth: boolean = true): Promise<void> => {
  if (smooth) {
    return smoothScrollTo(element, 0);
  } else {
    element.scrollTop = 0;
    return Promise.resolve();
  }
};

/**
 * 滚动到元素底部
 */
export const scrollToBottom = (element: HTMLElement, smooth: boolean = true): Promise<void> => {
  const targetScrollTop = element.scrollHeight - element.clientHeight;

  if (smooth) {
    return smoothScrollTo(element, targetScrollTop);
  } else {
    element.scrollTop = targetScrollTop;
    return Promise.resolve();
  }
};

/**
 * 创建简化的滚动边界信息
 */
export const createScrollBoundary = (element: HTMLElement, threshold: number = 5): ScrollBoundary => {
  const scrollTop = element.scrollTop;
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;

  const isAtTop = scrollTop <= threshold;
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
  const canScrollUp = !isAtTop;
  const canScrollDown = !isAtBottom;

  return {
    element,
    canScrollUp,
    canScrollDown,
    isAtTop,
    isAtBottom,
    scrollTop,
    scrollHeight,
    clientHeight
  };
};

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * 节流函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      func(...args);
    }
  };
};

/**
 * 检查是否支持平滑滚动
 */
export const supportsSmoothScroll = (): boolean => {
  return 'scrollBehavior' in document.documentElement.style;
};

/**
 * 获取滚动容器
 * 向上查找第一个可滚动的父元素
 */
export const getScrollContainer = (element: HTMLElement): HTMLElement | null => {
  let parent = element.parentElement;

  while (parent) {
    const computedStyle = window.getComputedStyle(parent);
    const overflowY = computedStyle.overflowY;

    if (overflowY === 'auto' || overflowY === 'scroll') {
      if (canElementScroll(parent)) {
        return parent;
      }
    }

    parent = parent.parentElement;
  }

  return document.documentElement;
};
