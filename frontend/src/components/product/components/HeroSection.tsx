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
    <span className={className} aria-label={text}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          className={charClass}
          initial={{ opacity: 0, y: 30, rotateX: -40 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.3 + i * 0.04,
            ease: [0.22, 1, 0.36, 1] as const,
          }}
          style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : undefined }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

export const HeroSection: React.FC = () => {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const line1 = t('product:hero.titleLine1');
  const line2 = t('product:hero.titleHighlight');

  return (
    <section id="hero" className={styles.hero}>
      <WaveBackground />
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        <motion.span
          className={styles.eyebrow}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <i className={styles.eyebrowDot} />
          {t('product:hero.badge')}
        </motion.span>

        <h1 className={styles.heading}>
          <AnimatedText text={line1} className={styles.headingLine1} charClass={styles.char} />
          <AnimatedText text={line2} className={styles.headingLine2} charClass={styles.charAccent} />
        </h1>

        <motion.p
          className={styles.description}
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
          <a href="#capabilities" className={styles.btnGhost}>
            {t('product:hero.ctaSecondary')}
          </a>
        </motion.div>
      </div>
    </section>
  );
};
