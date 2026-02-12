import React from 'react';
import { motion } from 'framer-motion';

interface DataStreamProps {
  color?: string;
  streamCount?: number;
}

export const DataStream: React.FC<DataStreamProps> = ({
  color = '#3B82F6',
  streamCount = 8,
}) => {
  const streams = Array.from({ length: streamCount }, (_, i) => ({
    id: i,
    left: (i / streamCount) * 100,
    delay: i * 0.2,
    duration: 3 + Math.random() * 2,
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
      {streams.map((stream) => (
        <div key={stream.id} style={{ position: 'absolute', left: `${stream.left}%`, width: '1px', height: '100%' }}>
          {/* 移动的光点 */}
          <motion.div
            animate={{
              y: ['0%', '100%'],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: stream.duration,
              repeat: Infinity,
              delay: stream.delay,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              width: '2px',
              height: '60px',
              background: `linear-gradient(180deg, transparent 0%, ${color}80 50%, transparent 100%)`,
              filter: 'blur(1px)',
            }}
          />

          {/* 轨迹线 */}
          <div
            style={{
              width: '1px',
              height: '100%',
              background: `linear-gradient(180deg, transparent 0%, ${color}10 50%, transparent 100%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default DataStream;
