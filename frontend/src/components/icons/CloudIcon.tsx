import React from 'react';

interface CloudIconProps extends React.SVGProps<SVGSVGElement> {
  /** 图标颜色，默认为橙色 rgb(255, 153, 0) */
  color?: string;
  /** 图标大小，默认为 1em（继承父元素字体大小） */
  size?: string | number;
}

/**
 * 云图标组件
 *
 * @param color - 图标颜色（默认橙色 #ff9900）
 * @param size - 图标大小（默认 1em）
 * @param props - 其他 SVG 属性
 *
 * @example
 * // 默认橙色
 * <CloudIcon />
 *
 * // 自定义颜色
 * <CloudIcon color="#1890ff" />
 *
 * // 固定大小
 * <CloudIcon size={32} />
 */
export const CloudIcon: React.FC<CloudIconProps> = ({
  color = 'rgb(255, 153, 0)',
  size = '1em',
  ...props
}) => (
  <svg
    viewBox="64 64 896 896"
    focusable="false"
    data-icon="cloud"
    width={size}
    height={size}
    fill={color}
    aria-hidden="true"
    style={{
      display: 'block',
      cursor: 'pointer',
      verticalAlign: '-4px',
      ...props.style
    }}
    {...props}
  >
    <path d="M811.4 418.7C765.6 297.9 648.9 212 512.2 212S258.8 297.8 213 418.6C127.3 441.1 64 519.1 64 612c0 110.5 89.5 200 199.9 200h496.2C870.5 812 960 722.5 960 612c0-92.7-63.1-170.7-148.6-193.3zm36.3 281a123.07 123.07 0 01-87.6 36.3H263.9c-33.1 0-64.2-12.9-87.6-36.3A123.3 123.3 0 01140 612c0-28 9.1-54.3 26.2-76.3a125.7 125.7 0 0166.1-43.7l37.9-9.9 13.9-36.6c8.6-22.8 20.6-44.1 35.7-63.4a245.6 245.6 0 0152.4-49.9c41.1-28.9 89.5-44.2 140-44.2s98.9 15.3 140 44.2c19.9 14 37.5 30.8 52.4 49.9 15.1 19.3 27.1 40.7 35.7 63.4l13.8 36.5 37.8 10c54.3 14.5 92.1 63.8 92.1 120 0 33.1-12.9 64.3-36.3 87.7z"></path>
  </svg>
);

export default CloudIcon;
