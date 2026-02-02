import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言包
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';

// 语言代码规范化：将短代码映射到完整代码
const normalizeLanguageCode = (lng: string): string => {
  const normalized = lng.toLowerCase().replace('_', '-');
  const mapping: Record<string, string> = {
    'zh': 'zh-CN',
    'zh-cn': 'zh-CN',
    'en': 'en-US',
    'en-us': 'en-US',
    'ja': 'ja-JP',
    'ja-jp': 'ja-JP'
  };
  return mapping[normalized] || lng;
};

// 清理旧的 localStorage 语言数据
const cleanupOldLanguageData = () => {
  const storedLng = localStorage.getItem('i18nextLng');
  if (storedLng) {
    const normalized = normalizeLanguageCode(storedLng);
    if (storedLng !== normalized) {
      localStorage.setItem('i18nextLng', normalized);
    }
  }
};

// 配置i18next
cleanupOldLanguageData();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': zhCN,
      'en-US': enUS,
      'ja-JP': jaJP
    },

    fallbackLng: 'zh-CN',

    debug: process.env.NODE_ENV === 'development',

    defaultNS: 'common',

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: normalizeLanguageCode
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false
    }
  });

export default i18n;
