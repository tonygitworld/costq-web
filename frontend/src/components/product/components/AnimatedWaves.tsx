import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedWavesProps {
  colors?: string[];
}

export const AnimatedWaves: React.FC<AnimatedWavesProps> = ({
  colors = ['#3B82F6', '#60A5FA', '#93C5FD'],
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
      {/* 第一层波浪 */}
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '-10%',
          width: '120%',
          height: '60%',
          background: `linear-gradient(180deg, transparent 0%, ${colors[0]}15 100%)`,
          borderRadius: '40% 60% 0 0',
        }}
      />

      {/* 第二层波浪 */}
      <motion.div
        animate={{
          x: [0, -50, 0],
          y: [0, -25, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '-10%',
          width: '120%',
          height: '50%',
          background: `linear-gradient(180deg, transparent 0%, ${colors[1]}10 100%)`,
          borderRadius: '50% 50% 0 0',
        }}
      />

      {/* 第三层波浪 */}
      <motion.div
        animate={{
          x: [0, 30, 0],
          y: [0, -15, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '-10%',
          width: '120%',
          height: '40%',
          background: `linear-gradient(180deg, transparent 0%, ${colors[2]}08 100%)`,
          borderRadius: '60% 40% 0 0',
        }}
      />
    </div>
  );
};

export default AnimatedWaves;
