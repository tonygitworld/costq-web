/**
 * FocusManager - 智能焦点管理组件
 *
 * 功能：
 * - 管理输入框的焦点状态
 * - 防止焦点变化导致的页面跳转（简化版）
 * - 提供平滑的焦点切换体验
 * - 支持键盘导航
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';

interface FocusManagerProps {
  children: React.ReactNode;
  onFocusChange?: (focused: boolean) => void;
  preventScrollOnFocus?: boolean;
  smoothTransition?: boolean;
}

export const FocusManager: React.FC<FocusManagerProps> = ({
  children,
  onFocusChange,
  preventScrollOnFocus = true,
  smoothTransition = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  // 简单的滚动位置保护
  const saveScrollPosition = useCallback(() => {
    const main = document.querySelector('.ant-layout-content') as HTMLElement;
    return main ? main.scrollTop : 0;
  }, []);

  const restoreScrollPosition = useCallback((position: number) => {
    const main = document.querySelector('.ant-layout-content') as HTMLElement;
    if (main) main.scrollTop = position;
  }, []);

  // 检测是否是键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      setFocusVisible(true);
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    setFocusVisible(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleKeyDown, handleMouseDown]);

  // 优化的焦点事件处理（简化版）
  const handleFocusIn = useCallback((e: React.FocusEvent) => {
    e.stopPropagation();

    if (preventScrollOnFocus) {
      const scrollPos = saveScrollPosition();
      setIsFocused(true);
      onFocusChange?.(true);

      // 在下一帧检查并恢复位置（如果有意外跳转）
      requestAnimationFrame(() => {
        const main = document.querySelector('.ant-layout-content') as HTMLElement;
        const currentPos = main ? main.scrollTop : 0;
        if (Math.abs(currentPos - scrollPos) > 10) {
          restoreScrollPosition(scrollPos);
        }
      });
    } else {
      setIsFocused(true);
      onFocusChange?.(true);
    }
  }, [preventScrollOnFocus, onFocusChange, saveScrollPosition, restoreScrollPosition]);

  const handleFocusOut = useCallback((e: React.FocusEvent) => {
    e.stopPropagation();

    // 检查焦点是否还在容器内
    const container = containerRef.current;
    if (container && !container.contains(e.relatedTarget as Node)) {
      if (preventScrollOnFocus) {
        const scrollPos = saveScrollPosition();
        setIsFocused(false);
        onFocusChange?.(false);

        // 在下一帧检查并恢复位置
        requestAnimationFrame(() => {
          const main = document.querySelector('.ant-layout-content') as HTMLElement;
          const currentPos = main ? main.scrollTop : 0;
          if (Math.abs(currentPos - scrollPos) > 10) {
            restoreScrollPosition(scrollPos);
          }
        });
      } else {
        setIsFocused(false);
        onFocusChange?.(false);
      }
    }
  }, [preventScrollOnFocus, onFocusChange, saveScrollPosition, restoreScrollPosition]);

  // 键盘导航支持
  const handleKeyDown2 = useCallback((e: React.KeyboardEvent) => {
    // 防止某些键盘事件导致页面跳转
    if (e.key === 'Home' || e.key === 'End') {
      // 只在输入框内处理，不影响页面滚动
      e.stopPropagation();
    }
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    outline: focusVisible && isFocused ? '2px solid #1890ff' : 'none',
    outlineOffset: '2px',
    transition: smoothTransition ? 'outline 0.2s ease' : 'none',
    // 确保焦点指示器不影响布局
    contain: 'layout style'
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onFocusCapture={handleFocusIn}
      onBlurCapture={handleFocusOut}
      onKeyDown={handleKeyDown2}
      data-focus-managed="true"
      data-focused={isFocused}
      data-focus-visible={focusVisible}
    >
      {children}
    </div>
  );
};
