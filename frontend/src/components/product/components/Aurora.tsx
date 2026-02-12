import React, { useEffect, useRef } from 'react';

interface AuroraProps {
  colorStops?: string[];
  blend?: number;
  amplitude?: number;
  speed?: number;
}

export const Aurora: React.FC<AuroraProps> = ({
  colorStops = ['#7cff67', '#B19EEF', '#5227FF'],
  blend = 0.5,
  amplitude = 1.0,
  speed = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布大小
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let time = 0;

    // 动画循环
    const animate = () => {
      time += 0.01 * speed;

      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 创建渐变
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

      // 添加颜色停止点，带动画效果
      colorStops.forEach((color, index) => {
        const offset = (index / (colorStops.length - 1) + Math.sin(time + index) * 0.1 * amplitude) % 1;
        gradient.addColorStop(Math.max(0, Math.min(1, offset)), color);
      });

      // 设置全局透明度（blend）
      ctx.globalAlpha = blend;

      // 绘制渐变背景
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 添加极光波动效果
      for (let i = 0; i < 3; i++) {
        const waveGradient = ctx.createRadialGradient(
          canvas.width / 2 + Math.sin(time + i) * canvas.width * 0.3 * amplitude,
          canvas.height / 2 + Math.cos(time + i) * canvas.height * 0.3 * amplitude,
          0,
          canvas.width / 2,
          canvas.height / 2,
          canvas.width * 0.8
        );

        const color1 = colorStops[i % colorStops.length];
        const color2 = colorStops[(i + 1) % colorStops.length];

        waveGradient.addColorStop(0, `${color1}${Math.floor(blend * 100).toString(16).padStart(2, '0')}`);
        waveGradient.addColorStop(0.5, `${color2}${Math.floor(blend * 50).toString(16).padStart(2, '0')}`);
        waveGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = waveGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [colorStops, blend, amplitude, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: blend,
      }}
    />
  );
};

export default Aurora;
