import React from 'react';
import { motion } from 'framer-motion';

interface FloatingDotsProps {
  dotColor?: string;
  dotCount?: number;
}

export const FloatingDots: React.FC<FloatingDotsProps> = ({
  dotColor = '#3B82F6',
  dotCount = 30,
}) => {
  const dots = Array.from({ length: dotCount }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  }));

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
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: dot.duration,
            repeat: Infinity,
            delay: dot.delay,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            borderRadius: '50%',
            background: dotColor,
            filter: 'blur(1px)',
          }}
        />
      ))}
    </div>
  );
};

export default FloatingDots;
