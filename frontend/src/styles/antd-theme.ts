// Ant Design theme configuration
// Compact密度 - 适合数据密集型应用

/**
 * 改进依据：
 * - Material Design 3 Compact Density: 基础字体11px，紧凑间距14px
 * - 8pt Grid System: 间距使用8的倍数（8px, 14px, 20px, 28px）
 * - 统一字体和间距密度，提升信息密度
 * - 适合AWS成本分析工具（数据密集型应用）
 */

export const antdTheme = {
  token: {
    // 品牌色
    colorPrimary: '#667eea',

    // 功能色
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',

    // 文字色
    colorTextBase: '#1a1a1a',
    colorTextSecondary: 'rgba(0,0,0,0.65)',
    colorTextTertiary: 'rgba(0,0,0,0.45)',
    colorTextQuaternary: 'rgba(0,0,0,0.25)',

    // 背景色
    colorBgLayout: '#f8f9fa',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgSpotlight: 'rgba(102, 126, 234, 0.05)',

    // 边框
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f0f0f0',

    // 圆角（保持原有设计）
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // 间距 - Compact密度（统一调整）
    padding: 14,         // 14px (Compact密度)
    paddingLG: 20,       // 20px (Compact密度)
    paddingSM: 8,        // 8px (小间距)
    paddingXS: 4,        // 4px (超小间距)

    // 字体大小 - Compact密度（统一调整）
    fontSize: 11,        // 基准字体 11px (Compact密度)
    fontSizeSM: 10,      // 小字体 10px
    fontSizeXS: 9,       // 超小字体 9px
    fontSizeLG: 13,      // 大字体 13px
    fontSizeXL: 15,      // 超大字体 15px
    fontSizeHeading1: 19,// H1: 19px (Compact密度)
    fontSizeHeading2: 16,// H2: 16px
    fontSizeHeading3: 14,// H3: 14px
    fontSizeHeading4: 13,// H4: 13px
    fontSizeHeading5: 11,// H5: 11px

    // 行高优化
    lineHeight: 1.5,
    lineHeightHeading1: 1.3,
    lineHeightHeading2: 1.3,
    lineHeightHeading3: 1.4,
  },

  components: {
    Layout: {
      siderBg: '#1a1f2e',
      bodyBg: '#f8f9fa',
      headerBg: '#ffffff',
    },
    Timeline: {
      tailColor: '#e9ecef',
      dotBorderWidth: 2,
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,        // Compact密度
    },
    Button: {
      controlHeight: 30,      // 标准高度 30px (Compact密度)
      controlHeightLG: 36,    // 大按钮 36px
      controlHeightSM: 22,    // 小按钮 22px
      paddingContentHorizontal: 14,  // 水平内边距 (Compact密度)
    },
    Input: {
      controlHeight: 30,      // 标准高度 30px (Compact密度)
      fontSize: 13,           // 字体大小 13px (Compact密度)
      paddingBlock: 4,        // 垂直内边距
      paddingInline: 11,      // 水平内边距 (Compact密度)
    },
    Select: {
      // 尺寸优化 - Compact密度
      controlHeight: 30,      // 标准高度 30px (Compact密度)
      fontSize: 13,           // 字体大小 13px (Compact密度)

      // 配色优化：纯白背景 + 淡蓝边框（清晰可交互，不像禁用状态）
      colorBgContainer: '#ffffff',          // 背景：纯白
      colorBorder: '#d9e3ff',               // 边框：淡蓝（呼应品牌色 #667eea）
      colorPrimaryBorder: '#667eea',        // focus 边框：品牌色
      colorPrimaryHover: '#8b9fff',         // hover 边框：稍亮的品牌色

      // 禁用状态（保持灰色以示区别）
      colorBgContainerDisabled: '#f5f5f5',
      colorTextDisabled: '#bfbfbf',

      // 圆角
      borderRadius: 6,
    },
    Message: {
      contentPadding: '10px 14px',  // Compact密度
      fontSize: 13,                 // Compact密度
    },
    Tooltip: {
      colorBgSpotlight: '#667eea',
      colorTextLightSolid: '#ffffff',
      fontSize: 11,                 // Compact密度
    }
  },
};
