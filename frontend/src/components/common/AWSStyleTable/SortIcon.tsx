import type { FC } from 'react';

interface SortIconProps {
  sortOrder: 'ascend' | 'descend' | null;
}

/**
 * AWS 风格排序三角形图标。
 * - 未排序：空心灰色三角朝下（stroke）
 * - 升序：实心黑色三角朝上（fill）
 * - 降序：实心黑色三角朝下（fill）
 */
export const SortIcon: FC<SortIconProps> = ({ sortOrder }) => {
  const isActive = sortOrder !== null;
  const rotation = sortOrder === 'ascend' ? 180 : 0;

  return (
    <span
      className={`aws-sort-icon${isActive ? ' aws-sort-icon-active' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
        cursor: 'pointer',
        padding: 2,
      }}
    >
      <svg
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        focusable={false}
        aria-hidden="true"
        width="20"
        height="20"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.2s ease',
        }}
      >
        <path
          d="M4.8 5Q3.6 5 4.3 6L7.3 11Q8 12 8.7 11L11.7 6Q12.4 5 11.2 5Z"
          className={isActive ? 'aws-sort-path-active' : 'aws-sort-path-inactive'}
        />
      </svg>
    </span>
  );
};
