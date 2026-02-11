import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAuthStore } from '@/stores/authStore';
import styles from './Navbar.module.css';

// 导航配置
const NAV_LINKS = [
  { id: 'hero', label: '首页', hash: '#hero' },
  { id: 'problem', label: '痛点', hash: '#problem' },
  { id: 'product-showcase', label: '产品展示', hash: '#product-showcase' },
  { id: 'roadmap', label: '产品规划', hash: '#roadmap' },
];

export const Navbar: React.FC = () => {
  const { t, language, changeLanguage } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [scrolled, setScrolled] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  const languages = [
    { code: 'zh-CN', label: '简体中文' },
    { code: 'en-US', label: 'English' },
    { code: 'ja-JP', label: '日本語' },
  ];

  useEffect(() => {
    // 滚动处理函数
    const handleScroll = () => {
      const container = document.getElementById('product-page-container');
      const scrollTop = container ? container.scrollTop : window.scrollY;

      // 只有滚动超过一定距离才变色
      setScrolled(scrollTop > 50);

      // 检测当前 Active Section (中心点距离算法)
      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;

      let currentSection = activeSection;
      let minDistance = Infinity;

      for (const link of NAV_LINKS) {
        const section = document.getElementById(link.id);
        if (section) {
          const rect = section.getBoundingClientRect();
          // 计算 section 中心点距离视口中心的绝对距离
          const sectionCenter = rect.top + rect.height / 2;
          const distance = Math.abs(sectionCenter - viewportCenter);

          // 找到距离视口中心最近的那个 section
          if (distance < minDistance) {
            minDistance = distance;
            currentSection = link.id;
          }
        }
      }

      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    // 优先监听容器滚动
    const container = document.getElementById('product-page-container');
    const target = container || window;

    target.addEventListener('scroll', handleScroll, { passive: true });

    // 初始化检查
    handleScroll();

    return () => target.removeEventListener('scroll', handleScroll);
  }, [activeSection]); // Add activeSection to dependency to avoid stale state logic, though logic handles it.

  const handleLangChange = (code: string) => {
    changeLanguage(code);
    setLangMenuOpen(false);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    const id = hash.replace('#', '');
    const element = document.getElementById(id);
    const container = document.getElementById('product-page-container');

    if (element && container) {
      // 在全屏滚动容器内，使用 container.scrollTo
      container.scrollTo({
        top: element.offsetTop,
        behavior: 'smooth'
      });
    } else if (element) {
      // 回退
      element.scrollIntoView({ behavior: 'smooth' });
    }

    // 手动立即更新 active 状态，提升响应感
    setActiveSection(id);
  };

  return (
    <motion.header
      className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <nav className={styles.nav}>
        {/* Left: Logo */}
        <Link to="/product" className={styles.logo}>
          <span className={styles.logoText}>CostQ</span>
        </Link>

        {/* Center: Navigation */}
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.hash}
              className={`${styles.navLink} ${activeSection === link.id ? styles.activeLink : ''}`}
              onClick={(e) => handleNavClick(e, link.hash)}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right: Actions */}
        <div className={styles.rightActions}>
          {/* Language Switcher */}
          <div className={styles.langWrapper}>
            <button
              className={styles.langBtn}
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              aria-label="Change language"
            >
              <Globe size={18} strokeWidth={2} />
              <span className={styles.currentLang}>{languages.find(l => l.code === language)?.label}</span>
            </button>

            <AnimatePresence>
              {langMenuOpen && (
                <motion.div
                  className={styles.langDropdown}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      className={`${styles.langOption} ${language === lang.code ? styles.activeLang : ''}`}
                      onClick={() => handleLangChange(lang.code)}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Check size={14} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CTA Button */}
          <Link to={isAuthenticated ? '/chat' : '/login'} className={styles.navCta}>
            {isAuthenticated ? '进入控制台' : '立即开始'}
          </Link>
        </div>
      </nav>
    </motion.header>
  );
};
