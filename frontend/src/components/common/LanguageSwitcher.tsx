/**
 * 语言切换器组件
 * 纯文字标签，无国旗，紧凑下拉
 */
import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './LanguageSwitcher.module.css';

const languages = [
  { key: 'zh-CN', label: '简体中文', short: '中文' },
  { key: 'en-US', label: 'English', short: 'EN' },
  { key: 'ja-JP', label: '日本語', short: 'JA' },
];

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const normalize = (lang: string): string => {
    const map: Record<string, string> = {
      'zh': 'zh-CN', 'zh-cn': 'zh-CN',
      'en': 'en-US', 'en-us': 'en-US',
      'ja': 'ja-JP', 'ja-jp': 'ja-JP',
    };
    return map[lang.toLowerCase().replace('_', '-')] || lang;
  };

  const current = normalize(i18n.language || 'zh-CN');
  const currentLang = languages.find(l => l.key === current) || languages[0];

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = async (key: string) => {
    try {
      await i18n.changeLanguage(key);
    } catch (e) {
      console.error('[LanguageSwitcher] Failed:', e);
    }
    setOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch language"
      >
        <Globe size={14} className={styles.triggerIcon} />
        <span className={styles.triggerLabel}>{currentLang.short}</span>
        <ChevronDown size={12} className={styles.triggerChevron} />
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          {languages.map(lang => (
            <button
              key={lang.key}
              type="button"
              role="option"
              aria-selected={current === lang.key}
              className={`${styles.item}${current === lang.key ? ` ${styles.itemActive}` : ''}`}
              onClick={() => handleSelect(lang.key)}
            >
              <span className={styles.itemLabel}>{lang.label}</span>
              {current === lang.key && <Check size={14} className={styles.itemCheck} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
