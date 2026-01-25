/**
 * 自定义国际化Hook
 * 提供便捷的翻译函数和语言管理
 */
import { useTranslation as useI18nextTranslation } from 'react-i18next';

/**
 * 使用国际化
 * @param namespace - 命名空间（common, auth, chat, account, user）
 * @returns 翻译函数和i18n实例
 */
export const useI18n = (namespace: string | string[] = 'common') => {
  const { t, i18n } = useI18nextTranslation(namespace);

  return {
    // 翻译函数
    t,

    // 当前语言
    language: i18n.language,

    // 切换语言
    changeLanguage: (lang: string) => i18n.changeLanguage(lang),

    // 是否是中文
    isZhCN: () => i18n.language === 'zh-CN',

    // 是否是英文
    isEnUS: () => i18n.language === 'en-US',

    // 是否是日文
    isJaJP: () => i18n.language === 'ja-JP',

    // i18n实例（用于高级用法）
    i18n
  };
};

/**
 * 多命名空间Hook（用于需要多个模块翻译的组件）
 * @param namespaces - 命名空间数组
 */
export const useMultiI18n = (...namespaces: string[]) => {
  return useI18n(namespaces);
};
