import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言包
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';

// 配置i18next
i18n
  // 使用语言检测器（自动检测浏览器语言）
  .use(LanguageDetector)
  // 使用react-i18next
  .use(initReactI18next)
  // 初始化配置
  .init({
    // 语言资源
    resources: {
      'zh-CN': zhCN,
      'en-US': enUS,
      'ja-JP': jaJP
    },

    // 默认语言
    fallbackLng: 'zh-CN',

    // 调试模式（生产环境设为false）
    debug: process.env.NODE_ENV === 'development',

    // 默认命名空间
    defaultNS: 'common',

    // 语言检测配置
    detection: {
      // 检测顺序：localStorage > 浏览器语言 > HTML lang属性
      order: ['localStorage', 'navigator', 'htmlTag'],
      // 缓存用户选择的语言
      caches: ['localStorage'],
      // localStorage的key名
      lookupLocalStorage: 'i18nextLng',
    },

    // 插值配置
    interpolation: {
      // React已经默认转义，不需要再转义
      escapeValue: false,
      // 格式化函数
      format: (value, format, lng) => {
        // 日期格式化
        if (format === 'date') {
          return new Date(value).toLocaleDateString(lng);
        }
        // 时间格式化
        if (format === 'datetime') {
          return new Date(value).toLocaleString(lng);
        }
        return value;
      }
    },

    // React配置
    react: {
      // 使用Suspense异步加载
      useSuspense: false
    }
  });

export default i18n;
