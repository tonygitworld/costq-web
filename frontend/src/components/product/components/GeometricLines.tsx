import React from 'react';
import { motion } from 'framer-motion';

interface GeometricLinesProps {
  lineColor?: string;
  lineCount?: number;
}

export const GeometricLines: React.FC<GeometricLinesProps> = ({
  lineColor = '#3B82F6',
  lineCount = 5,
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
      }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0" />
            <stop offset="50%" stopColor={lineColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 对角线 */}
        {[...Array(lineCount)].map((_, i) => (
          <motion.line
            key={`diagonal-${i}`}
            x1={`${i * 20}%`}
            y1="0%"
            x2={`${100 + i * 20}%`}
            y2="100%"
            stroke="url(#lineGrad)"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, delay: i * 0.2 }}
          />
        ))}

        {/* 圆形 */}
        <motion.circle
          cx="80%"
          cy="20%"
          r="150"
          fill="none"
          stroke={lineColor}
          strokeWidth="1"
          opacity="0.1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />

        <motion.circle
          cx="20%"
          cy="80%"
          r="100"
          fill="none"
          stroke={lineColor}
          strokeWidth="1"
          opacity="0.08"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, delay: 0.8 }}
        />
      </svg>
    </div>
  );
};

export default GeometricLines;
