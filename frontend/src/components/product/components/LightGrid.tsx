import React from 'react';

interface LightGridProps {
  gridColor?: string;
  glowColor?: string;
  opacity?: number;
}

export const LightGrid: React.FC<LightGridProps> = ({
  gridColor = '#3B82F6',
  glowColor = '#60A5FA',
  opacity = 0.15,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity,
      }}
    >
      {/* 垂直线 */}
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute' }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gridColor} stopOpacity="0" />
            <stop offset="50%" stopColor={gridColor} stopOpacity="1" />
            <stop offset="100%" stopColor={gridColor} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[...Array(10)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${i * 10}%`}
            y1="0%"
            x2={`${i * 10}%`}
            y2="100%"
            stroke="url(#lineGradient)"
            strokeWidth="1"
            filter="url(#glow)"
          />
        ))}

        {[...Array(10)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0%"
            y1={`${i * 10}%`}
            x2="100%"
            y2={`${i * 10}%`}
            stroke="url(#lineGradient)"
            strokeWidth="1"
            filter="url(#glow)"
          />
        ))}
      </svg>

      {/* 光晕 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          height: '80%',
          background: `radial-gradient(circle, ${glowColor}20 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
};

export default LightGrid;
