/**
 * ThemeSwitcher - 主题切换组件
 * 支持浅色/深色模式切换，并自动检测系统偏好
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Switch, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useI18n } from '../../hooks/useI18n';

type Theme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'costq-theme';

/**
 * 获取系统偏好的主题
 */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * 应用主题到 DOM
 */
const applyTheme = (theme: Theme) => {
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
};

/**
 * 从 localStorage 获取保存的主题
 */
const getSavedTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
};

/**
 * 保存主题到 localStorage
 */
const saveTheme = (theme: Theme) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
};

export const ThemeSwitcher: React.FC = () => {
  const { t } = useI18n('common');
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  // 初始化主题
  useEffect(() => {
    const savedTheme = getSavedTheme();
    setTheme(savedTheme);
    applyTheme(savedTheme);
    setMounted(true);
  }, []);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // 切换主题
  const toggleTheme = useCallback((checked: boolean) => {
    const newTheme: Theme = checked ? 'dark' : 'light';
    setTheme(newTheme);
    saveTheme(newTheme);
    applyTheme(newTheme);
  }, []);

  // 获取当前实际显示的主题
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  const isDark = effectiveTheme === 'dark';

  // 防止服务端渲染不匹配
  if (!mounted) {
    return null;
  }

  return (
    <Tooltip title={isDark ? t('theme.switchToLight', '切换到浅色模式') : t('theme.switchToDark', '切换到深色模式')}>
      <Switch
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
        checked={isDark}
        onChange={toggleTheme}
        size="small"
        style={{ marginLeft: 8 }}
      />
    </Tooltip>
  );
};

export default ThemeSwitcher;
