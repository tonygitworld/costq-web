// AuroraBackground/index.tsx - 首屏极光背景组件（支持完整降级策略）
import { type FC, useEffect, useState, useRef } from 'react';
import styles from './AuroraBackground.module.css';

/**
 * ★ P0: Aurora 背景组件 - 性能优先设计
 *
 * 核心原则：
 * 1. 不阻塞首屏可交互（延迟挂载）
 * 2. 支持 prefers-reduced-motion 自动降级
 * 3. 移动端/低端机可降级（降低分辨率/帧率/直接关闭）
 * 4. 与内容层完全解耦（pointer-events: none）
 * 5. 可独立开关、易回滚
 */

interface AuroraBackgroundProps {
  /** 是否启用 Aurora 效果（总开关，默认 true） */
  enabled?: boolean;
  /** 延迟挂载时间（ms），避免阻塞首屏（默认 100ms） */
  delayMount?: number;
  /** 强制降级模式（用于测试或特定场景） */
  forceReducedMotion?: boolean;
  /** 自定义 z-index */
  zIndex?: number;
}

// ★ P0: 检测用户是否偏好减少动画
const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// ★ P0: 检测是否为低端设备（基于硬件并发数和内存）
const useIsLowEndDevice = (): boolean => {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    // 检测逻辑：
    // 1. 逻辑处理器 <= 4
    // 2. 设备内存 <= 4GB
    // 3. 不支持 requestIdleCallback（旧设备）
    const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const lowMemory = 'deviceMemory' in navigator && (navigator as any).deviceMemory <= 4;
    const noIdleCallback = !('requestIdleCallback' in window);

    setIsLowEnd(lowCores || lowMemory || noIdleCallback);
  }, []);

  return isLowEnd;
};

// ★ P0: 检测是否为移动端
const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(checkMobile);
  }, []);

  return isMobile;
};

export const AuroraBackground: FC<AuroraBackgroundProps> = ({
  enabled = true,
  delayMount = 100,
  forceReducedMotion = false,
  zIndex = 0,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  const prefersReducedMotion = usePrefersReducedMotion();
  const isLowEnd = useIsLowEndDevice();
  const isMobile = useIsMobile();

  // ★ P0: 延迟挂载，避免阻塞首屏
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      setIsMounted(true);
      // 淡入效果
      requestAnimationFrame(() => setIsVisible(true));
    }, delayMount);

    return () => clearTimeout(timer);
  }, [enabled, delayMount]);

  // ★ P0: WebGL Aurora 动画
  useEffect(() => {
    if (!isMounted || !canvasRef.current) return;

    // ★ P0: 降级策略 - 如果用户偏好减少动画或低端设备，使用 CSS 版
    const shouldUseReducedMotion = forceReducedMotion || prefersReducedMotion || isLowEnd;

    if (shouldUseReducedMotion) {
      // 降级模式：使用 CSS 动画，不初始化 WebGL
      return;
    }

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false, // ★ P0: 关闭抗锯齿以提升性能
      powerPreference: 'low-power', // ★ P0: 优先低功耗模式
    });

    if (!gl) {
      // WebGL 不支持，降级到 CSS
      return;
    }

    // ★ P0: 移动端降低分辨率
    const dpr = isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // ★ P0: 简化的 Aurora Shader（性能优先）
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 resolution;
      uniform float time;

      // 简化的噪声函数
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= resolution.x / resolution.y;

        // ★ P0: 简化的 Aurora 效果（减少计算量）
        float t = time * 0.15;

        // 三层渐变
        float n1 = noise(p * 1.5 + t * 0.5);
        float n2 = noise(p * 2.0 - t * 0.3);
        float n3 = noise(p * 1.0 + t * 0.2);

        // 颜色混合（蓝紫青）
        vec3 color1 = vec3(0.15, 0.4, 0.9);  // 蓝
        vec3 color2 = vec3(0.55, 0.25, 0.9); // 紫
        vec3 color3 = vec3(0.05, 0.7, 0.6);  // 青

        vec3 color = mix(color1, color2, n1 * 0.5 + 0.5);
        color = mix(color, color3, n2 * 0.3);

        // 边缘淡化
        float vignette = 1.0 - length(uv - 0.5) * 0.8;
        color *= vignette;

        // ★ P0: 低透明度，不抢内容
        float alpha = (n3 * 0.15 + 0.05) * vignette;

        gl_FragColor = vec4(color, alpha);
      }
    `;

    // 编译 shader
    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // 设置顶点
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, 'resolution');
    const timeLoc = gl.getUniformLocation(program, 'time');

    let startTime = Date.now();
    let isActive = true;

    // ★ P0: 帧率控制（移动端 30fps，桌面端 60fps）
    const targetFPS = isMobile ? 30 : 60;
    const frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;

    const render = () => {
      if (!isActive) return;

      const now = Date.now();
      const elapsed = now - startTime;

      // 帧率控制
      if (now - lastFrameTime < frameInterval) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = now;

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, elapsed / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      frameCountRef.current++;
      animationRef.current = requestAnimationFrame(render);
    };

    // ★ P0: 可见性检测 - 页面不可见时暂停动画
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActive = false;
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      } else {
        isActive = true;
        startTime = Date.now() - elapsed;
        render();
      }
    };

    let elapsed = 0;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    render();

    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, [isMounted, isMobile, isLowEnd, prefersReducedMotion, forceReducedMotion]);

  // ★ P0: 如果禁用或未挂载，返回 null
  if (!enabled || !isMounted) {
    return null;
  }

  // ★ P0: 降级模式 - CSS 动画版（性能更好，效果简化）
  const shouldUseReducedMotion = forceReducedMotion || prefersReducedMotion || isLowEnd || isMobile;

  if (shouldUseReducedMotion) {
    return (
      <div
        className={`${styles.auroraFallback} ${isVisible ? styles.visible : ''}`}
        style={{ zIndex }}
        aria-hidden="true"
      />
    );
  }

  // ★ P0: 完整模式 - WebGL Canvas
  return (
    <canvas
      ref={canvasRef}
      className={`${styles.auroraCanvas} ${isVisible ? styles.visible : ''}`}
      style={{ zIndex }}
      aria-hidden="true"
    />
  );
};

export default AuroraBackground;
