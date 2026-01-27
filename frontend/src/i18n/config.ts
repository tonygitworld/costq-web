// 语言配置统一管理
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import type { Locale } from 'antd/lib/locale';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'ja-JP'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// 语言配置
export interface LanguageConfig {
  label: string;       // 完整名称
  shortLabel: string;  // 短名称
  antdLocale: Locale;  // Ant Design locale
  dayjsLocale: string; // dayjs locale
}

// 语言配置映射
export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
  'zh-CN': {
    label: '简体中文',
    shortLabel: '中文',
    antdLocale: zhCN,
    dayjsLocale: 'zh-cn'
  },
  'en-US': {
    label: 'English',
    shortLabel: 'EN',
    antdLocale: enUS,
    dayjsLocale: 'en'
  },
  'ja-JP': {
    label: '日本語',
    shortLabel: '日本語',
    antdLocale: jaJP,
    dayjsLocale: 'ja'
  }
};

// 获取语言配置
export const getLanguageConfig = (lang: string): LanguageConfig => {
  return LANGUAGE_CONFIG[lang as SupportedLanguage] || LANGUAGE_CONFIG['zh-CN'];
};

// 判断是否支持的语言
export const isSupportedLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

// 获取默认语言
export const getDefaultLanguage = (): SupportedLanguage => 'zh-CN';
