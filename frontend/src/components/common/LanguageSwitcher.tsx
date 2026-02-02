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

// 语言配置
const languages = [
  {
    key: 'zh-CN' as const,
    label: '简体中文',
    shortLabel: '中文',
  },
  {
    key: 'en-US' as const,
    label: 'English',
    shortLabel: 'English',
  },
  {
    key: 'ja-JP' as const,
    label: '日本語',
    shortLabel: '日本語',
  }
];

interface LanguageSwitcherProps {
  type?: 'dropdown' | 'buttons';
  showIcon?: boolean;
  showText?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  type = 'dropdown',
  showIcon = true,
  showText = true
}) => {
  const { i18n } = useTranslation();

  // 语言代码规范化
  const normalizeLanguage = (lang: string): string => {
    const normalized = lang.toLowerCase().replace('_', '-');
    const mapping: Record<string, string> = {
      'zh': 'zh-CN',
      'zh-cn': 'zh-CN',
      'en': 'en-US',
      'en-us': 'en-US',
      'ja': 'ja-JP',
      'ja-jp': 'ja-JP'
    };
    return mapping[normalized] || lang;
  };

  const currentLanguage = normalizeLanguage(i18n.language || 'zh-CN');

  const handleLanguageChange = async (langKey: string) => {
    try {
      // 切换 i18next 语言
      // react-i18next 会自动通知所有订阅了翻译的组件重新渲染
      await i18n.changeLanguage(langKey);

      // I18nProvider 会自动处理：
      // - Ant Design locale 更新
      // - dayjs locale 更新
      // - HTML lang 属性更新

      // localStorage 会由 i18next-browser-languagedetector 自动保存
    } catch (error) {
      console.error('[LanguageSwitcher] 语言切换失败:', error);
    }
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
      )
    }));

    const handleMenuClick: MenuProps['onClick'] = (info) => {
      handleLanguageChange(info.key);
    };

    return (
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenuClick }}
        trigger={['click']}
        placement="bottomRight"
        getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
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
