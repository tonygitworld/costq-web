import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthStore } from '@/stores/authStore';
import styles from './HeroSection.module.css';

export const HeroSection: React.FC = () => {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.gridBg} />

      <div className={styles.container}>
        {/* Badge */}
        <motion.div
          className={styles.badge}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Zap size={14} />
          <span>{t('product:hero.badge')}</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {t('product:hero.titleLine1')}<span className={styles.highlight}>{t('product:hero.titleHighlight')}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {t('product:hero.subtitle')}
        </motion.p>

        {/* CTA */}
        <motion.div
          className={styles.ctaGroup}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link to={isAuthenticated ? '/chat' : '/login'} className={styles.primaryBtn}>
            <span>{t('product:hero.ctaPrimary')}</span>
            <ArrowRight size={18} />
          </Link>
          <a href="#product-showcase" className={styles.secondaryBtn}>
            <BarChart3 size={18} />
            <span>{t('product:hero.ctaSecondary')}</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
};
