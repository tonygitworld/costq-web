import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Eye, Brain, Zap } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ProductRoadmapSection.module.css';

export const ProductRoadmapSection: React.FC = () => {
  const { t } = useI18n(['product', 'common']);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const roadmapSteps = [
    {
      phase: t('product:roadmap.phase1.phase'),
      status: 'completed',
      title: t('product:roadmap.phase1.title'),
      icon: Eye,
      features: [
        t('product:roadmap.phase1.features.0'),
        t('product:roadmap.phase1.features.1'),
        t('product:roadmap.phase1.features.2')
      ],
      date: t('product:roadmap.phase1.date')
    },
    {
      phase: t('product:roadmap.phase2.phase'),
      status: 'current',
      title: t('product:roadmap.phase2.title'),
      icon: Brain,
      features: [
        t('product:roadmap.phase2.features.0'),
        t('product:roadmap.phase2.features.1'),
        t('product:roadmap.phase2.features.2')
      ],
      date: t('product:roadmap.phase2.date')
    },
    {
      phase: t('product:roadmap.phase3.phase'),
      status: 'planned',
      title: t('product:roadmap.phase3.title'),
      icon: Zap,
      features: [
        t('product:roadmap.phase3.features.0'),
        t('product:roadmap.phase3.features.1'),
        t('product:roadmap.phase3.features.2')
      ],
      date: t('product:roadmap.phase3.date')
    }
  ];

  return (
    <section ref={ref} id="roadmap" className={styles.roadmapContainer}>
      <div className={styles.header}>
        <span className={styles.label}>{t('product:roadmap.label')}</span>
        <h2 className={styles.title}>{t('product:roadmap.title')}</h2>
        <p className={styles.subtitle}>{t('product:roadmap.subtitle')}</p>
      </div>

      <div className={styles.timelineWrapper}>
        {/* Horizontal connecting line */}
        <div className={styles.trackLine}>
          <motion.div
            className={styles.trackProgress}
            initial={{ width: 0 }}
            animate={isInView ? { width: '50%' } : {}}
            transition={{ duration: 1.5, delay: 0.5, ease: 'easeInOut' }}
          />
        </div>

        <div className={styles.stepsRow}>
          {roadmapSteps.map((step, index) => (
            <motion.div
              key={index}
              className={`${styles.step} ${styles[step.status]}`}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 + index * 0.2, duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              {/* Node */}
              <div className={styles.node}>
                <div className={styles.nodeInner}>
                  <step.icon size={22} strokeWidth={1.5} />
                </div>
              </div>

              {/* Card */}
              <div className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.phaseBadge}>{step.phase}</span>
                  <span className={styles.date}>{step.date}</span>
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <ul className={styles.featureList}>
                  {step.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
