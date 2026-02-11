import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './FooterCTA.module.css';

export const FooterCTA: React.FC = () => {
  const { t } = useI18n();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <section id="cta" className={styles.section}>
        {/* Animated Background */}
        <div className={styles.bgAnimated}>
          <div className={styles.gradientOrb1} />
          <div className={styles.gradientOrb2} />
        </div>

        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <Sparkles className={styles.icon} size={48} strokeWidth={1.5} />
            <h2 className={styles.title}>{t('product:cta.title')}</h2>
            <p className={styles.subtitle}>{t('product:cta.subtitle')}</p>
            <button onClick={scrollToTop} className={styles.button}>
              {t('product:cta.button')}
              <ArrowRight size={20} strokeWidth={2.5} />
            </button>
            <p className={styles.trust}>✓ {t('product:cta.trust')}</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.tagline}>{t('product:footer.tagline')}</p>
          <p className={styles.copyright}>{t('product:footer.copyright')}</p>
        </div>
      </footer>
    </>
  );
};
