// Ant Design theme configuration
// 舒适密度 - 适合企业级SaaS应用

/**
 * 改进依据：
 * - Material Design 3 Comfortable Density: 基础字体14px
 * - ui-ux-pro-max Font Size Scale: xs(12) sm(13) base(14) lg(16) h4(16) h3(18) h2(20) h1(24)
 * - 8pt Grid System: 间距使用8的倍数（8px, 16px, 24px, 32px）
 * - 与 responsive.css 舒适密度保持一致
 * - 平衡可读性与信息密度，适合企业级应用
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

    // 间距 - 舒适密度（与 responsive.css 一致）
    padding: 16,         // 16px (舒适密度)
    paddingLG: 24,       // 24px (舒适密度)
    paddingSM: 8,        // 8px (小间距)
    paddingXS: 4,        // 4px (超小间距)

    // 字体大小 - 舒适密度（与 responsive.css 一致）
    // 参考 ui-ux-pro-max: Type scale (12 14 16 18 24 32)
    fontSize: 14,        // 基准字体 14px (舒适密度，业界标准)
    fontSizeSM: 13,      // 小字体 13px
    fontSizeXS: 12,      // 超小字体 12px
    fontSizeLG: 16,      // 大字体 16px
    fontSizeXL: 18,      // 超大字体 18px
    fontSizeHeading1: 24,// H1: 24px (舒适密度)
    fontSizeHeading2: 20,// H2: 20px
    fontSizeHeading3: 18,// H3: 18px
    fontSizeHeading4: 16,// H4: 16px
    fontSizeHeading5: 14,// H5: 14px

    // 行高优化
    lineHeight: 1.5715,  // Ant Design 默认行高
    lineHeightHeading1: 1.3,
    lineHeightHeading2: 1.35,
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
      paddingLG: 24,        // 舒适密度
    },
    Button: {
      controlHeight: 32,      // 标准高度 32px (舒适密度，Ant Design 默认)
      controlHeightLG: 40,    // 大按钮 40px
      controlHeightSM: 24,    // 小按钮 24px
      paddingContentHorizontal: 16,  // 水平内边距 (舒适密度)
      fontSize: 14,           // 按钮字体 14px
    },
    Input: {
      controlHeight: 32,      // 标准高度 32px (舒适密度)
      fontSize: 14,           // 字体大小 14px (舒适密度)
      paddingBlock: 4,        // 垂直内边距
      paddingInline: 12,      // 水平内边距 (舒适密度)
    },
    Select: {
      // 尺寸优化 - 舒适密度
      controlHeight: 32,      // 标准高度 32px (舒适密度)
      fontSize: 14,           // 字体大小 14px (舒适密度)

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
    Table: {
      // 表格字体 - 舒适密度
      fontSize: 14,           // 表格内容 14px
      fontSizeSM: 13,         // 小尺寸表格 13px
    },
    Menu: {
      // 菜单字体 - 舒适密度
      fontSize: 14,           // 菜单项 14px
      itemHeight: 40,         // 菜单项高度 40px
      subMenuItemBg: 'transparent',
    },
    Modal: {
      // Modal 字体 - 舒适密度
      fontSize: 14,           // Modal 内容 14px
      titleFontSize: 16,      // Modal 标题 16px
    },
    Message: {
      contentPadding: '10px 16px',  // 舒适密度
      fontSize: 14,                 // 消息字体 14px
    },
    Tooltip: {
      colorBgSpotlight: '#667eea',
      colorTextLightSolid: '#ffffff',
      fontSize: 13,                 // Tooltip 稍小 13px
    },
    Dropdown: {
      // 下拉菜单 - 舒适密度
      fontSize: 14,
      controlItemBgHover: 'rgba(102, 126, 234, 0.08)',
    },
    Form: {
      // 表单 - 舒适密度
      fontSize: 14,
      labelFontSize: 14,
      verticalLabelPadding: '0 0 8px',
    },
    Tabs: {
      // 标签页 - 舒适密度
      titleFontSize: 14,
      titleFontSizeLG: 16,
      titleFontSizeSM: 13,
    },
    Breadcrumb: {
      // 面包屑 - 舒适密度
      fontSize: 14,
    },
    Pagination: {
      // 分页 - 舒适密度
      fontSize: 14,
      itemSize: 32,
      itemSizeSM: 24,
    },
    Tag: {
      // 标签 - 稍小
      fontSize: 12,
    },
    Badge: {
      // 徽标 - 稍小
      fontSize: 12,
    },
  },
};
