/**
 * 自定义国际化Hook
 * 提供便捷的翻译函数和语言管理
 */
import { useTranslation as useI18nextTranslation } from 'react-i18next';

// 语言代码规范化函数
const normalizeLanguage = (lng: string): string => {
  const normalized = lng.toLowerCase().replace('_', '-');
  const mapping: Record<string, string> = {
    'zh': 'zh-CN',
    'zh-cn': 'zh-CN',
    'en': 'en-US',
    'en-us': 'en-US',
    'ja': 'ja-JP',
    'ja-jp': 'ja-JP'
  };
  return mapping[normalized] || normalized;
};

export const useI18n = (namespace: string | string[] = 'common') => {
  const { t, i18n } = useI18nextTranslation(namespace);
  const normalizedLanguage = normalizeLanguage(i18n.language);

  return {
    t,
    language: normalizedLanguage,
    changeLanguage: (lang: string) => i18n.changeLanguage(normalizeLanguage(lang)),
    isZhCN: () => normalizedLanguage === 'zh-CN',
    isEnUS: () => normalizedLanguage === 'en-US',
    isJaJP: () => normalizedLanguage === 'ja-JP',
    i18n
  };
};
