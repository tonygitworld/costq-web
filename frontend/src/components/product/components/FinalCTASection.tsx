import React from 'react';
import { motion } from 'framer-motion';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import styles from './FinalCTASection.module.css';

export const FinalCTASection: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { ref: sectionRef, isInView } = useScrollAnimation({ once: true, amount: 0.3 });

  return (
    <section id="final-cta" ref={sectionRef} className={styles.section}>
      <div className={styles.container}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <h2 className={styles.title}>
            {t('product:finalCTA.title')}
          </h2>
          <p className={styles.subtitle}>
            {t('product:finalCTA.subtitle')}
          </p>

          <div className={styles.actions}>
            <button className={styles.primaryButton} onClick={() => navigate('/login')}>
              {t('product:finalCTA.buttonPrimary')}
              <ArrowRight size={18} />
            </button>
            <button className={styles.secondaryButton} onClick={() => window.location.href = 'mailto:sales@costq.com'}>
              <MessageSquareText size={18} />
              {t('product:finalCTA.buttonSecondary')}
            </button>
          </div>

        </motion.div>
      </div>
    </section>
  );
};
