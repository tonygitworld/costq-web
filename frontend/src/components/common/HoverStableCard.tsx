import React, { useState, useCallback } from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';
import classNames from 'classnames';
import { ErrorHandler } from '../../utils/ErrorHandler';

interface HoverStableCardProps extends Omit<CardProps, 'className'> {
  children: React.ReactNode;
  className?: string;
  hoverClassName?: string;
  hoverStyle?: React.CSSProperties;
  disableHoverEffect?: boolean;
}

/**
 * HoverStableCard - 提供稳定hover效果的Card组件
 *
 * 特点：
 * - 使用transform和opacity进行hover效果，避免布局重排
 * - 不改变元素的盒模型尺寸
 * - 提供平滑的过渡动画
 * - 支持自定义hover样式
 */
export const HoverStableCard: React.FC<HoverStableCardProps> = ({
  children,
  className,
  hoverClassName,
  hoverStyle,
  disableHoverEffect = false,
  style,
  ...cardProps
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const errorHandler = ErrorHandler.getInstance();

  const handleMouseEnter = useCallback(() => {
    if (!disableHoverEffect && errorHandler.isFeatureEnabled('enableHoverEffects')) {
      errorHandler.safeExecute(
        () => setIsHovered(true),
        undefined,
        'HoverStableCard',
        'MouseEnterError'
      );
    }
  }, [disableHoverEffect, errorHandler]);

  const handleMouseLeave = useCallback(() => {
    if (!disableHoverEffect && errorHandler.isFeatureEnabled('enableHoverEffects')) {
      errorHandler.safeExecute(
        () => setIsHovered(false),
        undefined,
        'HoverStableCard',
        'MouseLeaveError'
      );
    }
  }, [disableHoverEffect, errorHandler]);

  // 基础样式 - 确保不会触发布局重排
  const baseStyle: React.CSSProperties = {
    transition: 'transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
    willChange: 'transform, opacity, box-shadow',
    ...style,
  };

  // 默认hover效果 - 仅使用transform和opacity
  const defaultHoverStyle: React.CSSProperties = {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  };

  // 合并hover样式
  const finalHoverStyle = hoverStyle || defaultHoverStyle;
  const appliedStyle = isHovered
    ? { ...baseStyle, ...finalHoverStyle }
    : baseStyle;

  const finalClassName = classNames(
    'hover-stable-card',
    className,
    {
      [hoverClassName || '']: isHovered && hoverClassName,
      'hover-stable-card--hovered': isHovered,
    }
  );

  return (
    <Card
      {...cardProps}
      className={finalClassName}
      style={appliedStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Card>
  );
};
