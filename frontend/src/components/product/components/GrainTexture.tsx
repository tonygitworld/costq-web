import React, { useEffect, useRef } from 'react';

interface GrainTextureProps {
  opacity?: number;
  baseColor?: string;
}

export const GrainTexture: React.FC<GrainTextureProps> = ({
  opacity = 0.03,
  baseColor = '#000000',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 300;

    // 生成噪点
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const buffer = new Uint32Array(imageData.data.buffer);

    for (let i = 0; i < buffer.length; i++) {
      const value = Math.random() * 255;
      buffer[i] = (255 << 24) | (value << 16) | (value << 8) | value;
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 50% 30%, ${baseColor}05, transparent 70%)`,
        }}
      />
    </div>
  );
};

export default GrainTexture;
