import React from 'react';

interface ScanlinesProps {
  lineColor?: string;
  spacing?: number;
  opacity?: number;
}

export const Scanlines: React.FC<ScanlinesProps> = ({
  lineColor = '#3B82F6',
  spacing = 4,
  opacity = 0.05,
}) => {
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
        backgroundImage: `repeating-linear-gradient(
          0deg,
          ${lineColor},
          ${lineColor} 1px,
          transparent 1px,
          transparent ${spacing}px
        )`,
      }}
    >
      {/* 额外的光晕效果 */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          height: '60%',
          background: `radial-gradient(circle, ${lineColor}15 0%, transparent 70%)`,
          filter: 'blur(100px)',
        }}
      />
    </div>
  );
};

export default Scanlines;
