import React from 'react';
import { motion } from 'framer-motion';

interface SpotlightProps {
  color?: string;
  intensity?: number;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  color = '#3B82F6',
  intensity = 0.3,
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
      {/* 主聚光灯 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: intensity, scale: 1 }}
        transition={{ duration: 1.5 }}
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '120%',
          background: `radial-gradient(ellipse at center top, ${color}40 0%, ${color}15 30%, transparent 60%)`,
          filter: 'blur(60px)',
        }}
      />

      {/* 边缘光晕 - 左 */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: intensity * 0.6, x: 0 }}
        transition={{ duration: 2, delay: 0.3 }}
        style={{
          position: 'absolute',
          top: '30%',
          left: '-10%',
          width: '40%',
          height: '40%',
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* 边缘光晕 - 右 */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: intensity * 0.6, x: 0 }}
        transition={{ duration: 2, delay: 0.5 }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-10%',
          width: '40%',
          height: '40%',
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
};

export default Spotlight;
