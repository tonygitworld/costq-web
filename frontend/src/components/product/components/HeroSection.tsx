import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthStore } from '@/stores/authStore';
import { WaveBackground } from './WaveBackground';
import styles from './HeroSection.module.css';

/* Split text into individual characters for staggered animation */
function AnimatedText({ text, className, charClass }: { text: string; className?: string; charClass?: string }) {
  return (
    <motion.span
      className={className}
      aria-label={text}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.7,
        delay: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          className={charClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.4,
            delay: 0.5 + i * 0.03,
            ease: 'easeOut',
          }}
          style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : undefined }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

export const HeroSection: React.FC = () => {
  const { t, language } = useI18n();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isEn = language === 'en-US';

  const isChinese = language === 'zh-CN';

  const line1 = t('product:hero.titleLine1');
  const line2 = t('product:hero.titleHighlight');

  return (
    <section id="hero" className={styles.hero}>
      <WaveBackground />
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        <h1 className={`${styles.heading} ${isEn ? styles.headingEn : ''}`}>
          {isChinese ? (
            <>
              <AnimatedText text={line1} className={styles.headingLine1} charClass={styles.char} />
              <AnimatedText text={line2} className={styles.headingLine2} charClass={styles.charAccent} />
            </>
          ) : (
            <>
              <motion.span
                className={styles.headingLine1}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {line1}
              </motion.span>
              <motion.span
                className={`${styles.headingLine2} ${styles.charAccent}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {line2}
              </motion.span>
            </>
          )}
        </h1>

        <motion.p
          className={`${styles.description} ${isEn ? styles.descriptionEn : ''}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          {t('product:hero.subtitle')}
        </motion.p>

        <motion.div
          className={styles.actions}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <Link to={isAuthenticated ? '/chat' : '/login'} className={styles.btnPrimary}>
            {t('product:hero.ctaPrimary')}
            <svg className={styles.btnArrow} width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <a href="#product-showcase" className={styles.btnGhost}>
            {t('product:hero.ctaSecondary')}
          </a>
        </motion.div>
      </div>
    </section>
  );
};
