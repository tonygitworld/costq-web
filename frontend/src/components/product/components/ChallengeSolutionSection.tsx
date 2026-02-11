import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ChallengeSolutionSection.module.css';

export const ChallengeSolutionSection: React.FC = () => {
  const { t } = useI18n();

  const comparisons = [
    {
      problem: {
        title: t('product:problem.pain1.title'),
        desc: t('product:problem.pain1.desc'),
      },
      solution: {
        title: t('product:solution.card1.title'),
        desc: t('product:solution.card1.desc'),
        type: 'chart'
      }
    },
    {
      problem: {
        title: t('product:problem.pain2.title'),
        desc: t('product:problem.pain2.desc'),
      },
      solution: {
        title: t('product:solution.card2.title'),
        desc: t('product:solution.card2.desc'),
        type: 'trend'
      }
    },
    {
      problem: {
        title: t('product:problem.pain3.title'),
        desc: t('product:problem.pain3.desc'),
      },
      solution: {
        title: t('product:solution.card4.title'),
        desc: t('product:solution.card4.desc'),
        type: 'list'
      }
    }
  ];

  const renderVisual = (type: string) => {
    switch (type) {
      case 'chart':
        return (
          <div style={{ height: '60px', width: '100%', marginTop: '16px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ width: '20%', height: '40%', background: '#3B82F6', borderRadius: '2px 2px 0 0', opacity: 0.5 }}></div>
            <div style={{ width: '20%', height: '70%', background: '#3B82F6', borderRadius: '2px 2px 0 0', opacity: 0.7 }}></div>
            <div style={{ width: '20%', height: '100%', background: '#3B82F6', borderRadius: '2px 2px 0 0' }}></div>
            <div style={{ width: '20%', height: '60%', background: '#3B82F6', borderRadius: '2px 2px 0 0', opacity: 0.6 }}></div>
          </div>
        );
      case 'trend':
        return (
          <div style={{ height: '60px', width: '100%', marginTop: '16px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
              <path d="M0,50 Q25,10 50,30 T100,10" fill="none" stroke="#A855F7" strokeWidth="3" />
              <path d="M0,50 Q25,10 50,30 T100,10 V60 H0 Z" fill="url(#grad)" opacity="0.2" />
              <defs>
                <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7"/>
                  <stop offset="100%" stopColor="transparent"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        );
      case 'list':
        return (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10B981' }}></div>
              <div style={{ height: '6px', width: '80%', background: '#334155', borderRadius: '4px' }}></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10B981' }}></div>
              <div style={{ height: '6px', width: '60%', background: '#334155', borderRadius: '4px' }}></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>从困境到掌控</h2>
          <p className={styles.subtitle}>传统管理方式已失效，CostQ 为您带来全新的 Agentic 体验</p>
        </div>

        <div className={styles.comparisonWrapper}>
          {/* Row 1: Challenges */}
          <div>
            <span className={`${styles.sectionLabel} ${styles.problemLabel}`}>传统挑战</span>
            <div className={styles.row}>
              {comparisons.map((item, idx) => (
                <motion.div
                  key={`p-${idx}`}
                  className={`${styles.card} ${styles.leftCard}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <h3 className={styles.leftCardTitle}>{item.problem.title}</h3>
                  <p className={styles.leftCardDesc}>{item.problem.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Row 2: Arrows */}
          <div className={styles.arrowRow}>
            {comparisons.map((_, idx) => (
              <div key={`arrow-${idx}`} className={styles.arrowWrapper}>
                <ArrowDown size={24} />
              </div>
            ))}
          </div>

          {/* Row 3: Solutions */}
          <div>
            <span className={`${styles.sectionLabel} ${styles.solutionLabel}`}>CostQ 方案</span>
            <div className={styles.row}>
              {comparisons.map((item, idx) => (
                <motion.div
                  key={`s-${idx}`}
                  className={`${styles.card} ${styles.rightCard}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                >
                  <h3 className={styles.rightCardTitle}>{item.solution.title}</h3>
                  <p className={styles.rightCardDesc}>{item.solution.desc}</p>
                  {renderVisual(item.solution.type)}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
