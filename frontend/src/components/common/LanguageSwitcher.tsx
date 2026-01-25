/**
 * 语言切换器组件
 * 支持中文、英文、日文三种语言切换
 */
import React from 'react';
import { Dropdown, Button, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { Flag } from './FlagIcons';
import dayjs from 'dayjs';

// 导入dayjs语言包
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';

// 导入Ant Design语言包
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';

// 语言配置
const languages = [
  {
    key: 'zh-CN' as const,
    label: '简体中文',
    shortLabel: '中文',
    antdLocale: zhCN,
    dayjsLocale: 'zh-cn'
  },
  {
    key: 'en-US' as const,
    label: 'English',
    shortLabel: 'English',
    antdLocale: enUS,
    dayjsLocale: 'en'
  },
  {
    key: 'ja-JP' as const,
    label: '日本語',
    shortLabel: '日本語',
    antdLocale: jaJP,
    dayjsLocale: 'ja'
  }
];

interface LanguageSwitcherProps {
  onLocaleChange?: (locale: typeof zhCN | typeof enUS | typeof jaJP) => void;
  type?: 'dropdown' | 'buttons';
  showIcon?: boolean;
  showText?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  onLocaleChange,
  type = 'dropdown',
  showIcon = true,
  showText = true
}) => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'zh-CN';

  const handleLanguageChange = (langKey: string) => {
    const lang = languages.find(l => l.key === langKey);
    if (!lang) return;

    // 1. 切换i18next语言
    i18n.changeLanguage(langKey);

    // 2. 切换dayjs语言（用于日期格式化）
    dayjs.locale(lang.dayjsLocale);

    // 3. 通知父组件更新Ant Design语言
    if (onLocaleChange) {
      onLocaleChange(lang.antdLocale);
    }

    // 4. 保存到localStorage（i18next会自动处理，这里是确保）
    localStorage.setItem('i18nextLng', langKey);
  };

  const currentLang = languages.find(l => l.key === currentLanguage) || languages[0];

  // 下拉菜单模式
  if (type === 'dropdown') {
    const menuItems: MenuProps['items'] = languages.map(lang => ({
      key: lang.key,
      label: (
        <Space size={10}>
          <Flag language={lang.key} width={24} height={16} />
          <span style={{ fontSize: '14px' }}>{lang.label}</span>
          {currentLanguage === lang.key && (
            <span style={{ color: '#52c41a', marginLeft: '4px' }}>✓</span>
          )}
        </Space>
      ),
      onClick: () => handleLanguageChange(lang.key)
    }));

    return (
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        placement="bottomRight"
      >
        <Button
          type="text"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            height: '36px',
            color: 'inherit',
          }}
        >
          {showIcon && (
            <GlobalOutlined style={{ fontSize: '16px', color: 'currentColor' }} />
          )}
          {showText && (
            <Space size={6}>
              <Flag language={currentLang.key} width={20} height={14} />
              <span style={{ fontSize: '13px', color: 'inherit', fontWeight: 500 }}>
                {currentLang.shortLabel}
              </span>
            </Space>
          )}
        </Button>
      </Dropdown>
    );
  }

  // 按钮组模式
  return (
    <Space size={8}>
      {languages.map(lang => (
        <Button
          key={lang.key}
          type={currentLanguage === lang.key ? 'primary' : 'default'}
          size="small"
          onClick={() => handleLanguageChange(lang.key)}
          style={{
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Flag language={lang.key} width={20} height={14} />
        </Button>
      ))}
    </Space>
  );
};
