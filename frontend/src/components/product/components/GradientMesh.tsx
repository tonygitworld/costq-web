import React from 'react';

interface GradientMeshProps {
  colors?: string[];
  blur?: number;
}

export const GradientMesh: React.FC<GradientMeshProps> = ({
  colors = ['#3B82F6', '#8B5CF6', '#EC4899'],
  blur = 120,
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
      {/* 第一个光斑 - 左上 */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50%',
          height: '50%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors[0]}40 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
        }}
      />

      {/* 第二个光斑 - 右上 */}
      <div
        style={{
          position: 'absolute',
          top: '-5%',
          right: '-10%',
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors[1]}35 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
        }}
      />

      {/* 第三个光斑 - 中央 */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '30%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors[2]}30 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
        }}
      />
    </div>
  );
};

export default GradientMesh;
