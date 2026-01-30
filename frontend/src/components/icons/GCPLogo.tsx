import React from 'react';

interface GCPLogoProps extends React.SVGProps<SVGSVGElement> {
  /** 图标颜色，默认为Google Cloud品牌色 */
  color?: string;
  /** 图标大小，默认为 1em（继承父元素字体大小） */
  size?: string | number;
}

/**
 * Google Cloud Platform Logo组件
 *
 * Google Cloud品牌色:
 * - 蓝色: #4285F4
 * - 红色: #EA4335
 * - 黄色: #FBBC04
 * - 绿色: #34A853
 *
 * SVG路径来源: Google官方品牌资源
 *
 * @param color - 图标颜色（默认使用Google Cloud品牌渐变）
 * @param size - 图标大小（默认 1em）
 * @param props - 其他 SVG 属性
 *
 * @example
 * // 默认Google Cloud颜色
 * <GCPLogo />
 *
 * // 自定义颜色
 * <GCPLogo color="#1890ff" />
 *
 * // 固定大小
 * <GCPLogo size={32} />
 */
export const GCPLogo: React.FC<GCPLogoProps> = ({
  color,
  size = '1em',
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    focusable="false"
    width={size}
    height={size}
    aria-hidden="true"
    style={{
      display: 'inline-block',
      verticalAlign: 'middle',
      ...props.style
    }}
    {...props}
  >
    <defs>
      <linearGradient id="gcp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#4285F4', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#34A853', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <path
      fill={color || 'url(#gcp-gradient)'}
      d="M22.56 12.29c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill={color || '#34A853'}
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill={color || '#FBBC04'}
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill={color || '#EA4335'}
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default GCPLogo;
