import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthStore } from '@/stores/authStore';
import styles from './HeroSection.module.css';

export const HeroSection: React.FC = () => {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return (
    <section id="hero" className={styles.hero}>
      {/* 动态渐变流光效果层 */}
      <div aria-hidden className={styles.effectLayer}>
        <div className={styles.radialMesh} />
        <div className={styles.conicSwirl}>
          <div className={styles.conicSwirlInner} />
        </div>
        <div className={styles.noiseTexture} />
        <div className={styles.gridLines} />
      </div>

      {/* 内容 */}
      <div className={styles.container}>
        {/* Title */}
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {t('product:hero.titleLine1')}
          <span className={styles.titleHighlight}>
            {t('product:hero.titleHighlight')}
          </span>
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
            <span className={styles.btnShine} />
            <span className={styles.primaryBtnText}>{t('product:hero.ctaPrimary')}</span>
          </Link>
          <a href="#product-showcase" className={styles.secondaryBtn}>
            <span>{t('product:hero.ctaSecondary')}</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
};
