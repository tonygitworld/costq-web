import { useRef } from 'react';
import { useInView } from 'framer-motion';

type UseInViewOptions = Parameters<typeof useInView>[1];

/**
 * 封装 useRef + useInView 的组合逻辑，用于控制滚动动画触发时机。
 * @param options - framer-motion useInView 的配置参数（once、amount 等）
 * @returns { ref, isInView }
 */
export function useScrollAnimation(options?: UseInViewOptions) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, options);
  return { ref, isInView };
}
