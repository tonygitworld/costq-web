/**
 * SVG国旗图标组件
 * 跨平台兼容的矢量图标，替代emoji
 */
import React from 'react';

interface FlagIconProps {
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

// 中国国旗 - 五星红旗
export const ChinaFlag: React.FC<FlagIconProps> = ({ width = 24, height = 16, style }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: '2px', ...style }}
  >
    <rect width="24" height="16" fill="#DE2910"/>
    <path d="M4 3L4.5 4.5L6 4.5L4.8 5.3L5.3 6.8L4 6L2.7 6.8L3.2 5.3L2 4.5L3.5 4.5L4 3Z" fill="#FFDE00"/>
    <path d="M7 2L7.3 2.8L8 2.8L7.5 3.2L7.7 4L7 3.6L6.3 4L6.5 3.2L6 2.8L6.7 2.8L7 2Z" fill="#FFDE00"/>
    <path d="M8.5 4.5L8.7 5.2L9.3 5.2L8.8 5.6L9 6.3L8.5 5.9L8 6.3L8.2 5.6L7.7 5.2L8.3 5.2L8.5 4.5Z" fill="#FFDE00"/>
    <path d="M8.5 7.5L8.7 8.2L9.3 8.2L8.8 8.6L9 9.3L8.5 8.9L8 9.3L8.2 8.6L7.7 8.2L8.3 8.2L8.5 7.5Z" fill="#FFDE00"/>
    <path d="M7 9.5L7.3 10.2L8 10.2L7.5 10.6L7.7 11.3L7 10.9L6.3 11.3L6.5 10.6L6 10.2L6.7 10.2L7 9.5Z" fill="#FFDE00"/>
  </svg>
);

// 美国国旗 - 星条旗简化版
export const USAFlag: React.FC<FlagIconProps> = ({ width = 24, height = 16, style }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: '2px', ...style }}
  >
    {/* 红白条纹 */}
    <rect width="24" height="1.23" fill="#B22234"/>
    <rect y="1.23" width="24" height="1.23" fill="white"/>
    <rect y="2.46" width="24" height="1.23" fill="#B22234"/>
    <rect y="3.69" width="24" height="1.23" fill="white"/>
    <rect y="4.92" width="24" height="1.23" fill="#B22234"/>
    <rect y="6.15" width="24" height="1.23" fill="white"/>
    <rect y="7.38" width="24" height="1.23" fill="#B22234"/>
    <rect y="8.61" width="24" height="1.23" fill="white"/>
    <rect y="9.84" width="24" height="1.23" fill="#B22234"/>
    <rect y="11.07" width="24" height="1.23" fill="white"/>
    <rect y="12.3" width="24" height="1.23" fill="#B22234"/>
    <rect y="13.53" width="24" height="1.23" fill="white"/>
    <rect y="14.76" width="24" height="1.23" fill="#B22234"/>
    {/* 蓝色方块（左上角） */}
    <rect width="9.6" height="8.62" fill="#3C3B6E"/>
    {/* 简化的星星（用圆点代替） */}
    <circle cx="2" cy="1.5" r="0.4" fill="white"/>
    <circle cx="4" cy="1.5" r="0.4" fill="white"/>
    <circle cx="6" cy="1.5" r="0.4" fill="white"/>
    <circle cx="8" cy="1.5" r="0.4" fill="white"/>
    <circle cx="3" cy="3" r="0.4" fill="white"/>
    <circle cx="5" cy="3" r="0.4" fill="white"/>
    <circle cx="7" cy="3" r="0.4" fill="white"/>
    <circle cx="2" cy="4.5" r="0.4" fill="white"/>
    <circle cx="4" cy="4.5" r="0.4" fill="white"/>
    <circle cx="6" cy="4.5" r="0.4" fill="white"/>
    <circle cx="8" cy="4.5" r="0.4" fill="white"/>
    <circle cx="3" cy="6" r="0.4" fill="white"/>
    <circle cx="5" cy="6" r="0.4" fill="white"/>
    <circle cx="7" cy="6" r="0.4" fill="white"/>
  </svg>
);

// 日本国旗 - 日之丸
export const JapanFlag: React.FC<FlagIconProps> = ({ width = 24, height = 16, style }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: '2px', ...style }}
  >
    <rect width="24" height="16" fill="white"/>
    <circle cx="12" cy="8" r="4.5" fill="#BC002D"/>
  </svg>
);

// 通用国旗组件（根据语言代码选择）
interface FlagProps extends FlagIconProps {
  language: 'zh-CN' | 'en-US' | 'ja-JP';
}

export const Flag: React.FC<FlagProps> = ({ language, ...props }) => {
  switch (language) {
    case 'zh-CN':
      return <ChinaFlag {...props} />;
    case 'en-US':
      return <USAFlag {...props} />;
    case 'ja-JP':
      return <JapanFlag {...props} />;
    default:
      return null;
  }
};
