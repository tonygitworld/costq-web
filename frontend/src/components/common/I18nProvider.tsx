/**
 * 国际化Provider
 * 同步react-i18next和Ant Design的语言设置
 */
import React, { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { antdTheme } from '../../styles/antd-theme';

// Ant Design语言包
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';

// dayjs语言包
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';

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

const antdLocales: Record<string, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP
};

const dayjsLocales: Record<string, string> = {
  'zh-CN': 'zh-cn',
  'en-US': 'en',
  'ja-JP': 'ja'
};

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [antdLocale, setAntdLocale] = useState(antdLocales[i18n.language] || zhCN);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      const normalizedLng = normalizeLanguage(lng);

      // 更新Ant Design语言
      const newLocale = antdLocales[normalizedLng] || zhCN;
      setAntdLocale(newLocale);

      // 更新dayjs语言
      const dayjsLng = dayjsLocales[normalizedLng] || 'zh-cn';
      dayjs.locale(dayjsLng);

      // 更新HTML lang属性
      document.documentElement.lang = normalizedLng;
    };

    // 初始化
    handleLanguageChange(i18n.language);

    // 监听语言变化
    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      {children}
    </ConfigProvider>
  );
};
