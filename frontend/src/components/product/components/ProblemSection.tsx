import React from 'react';
import { motion } from 'framer-motion';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { FileText, Search, Shield, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ProblemSection.module.css';

export const ProblemSection: React.FC = () => {
  const { t } = useI18n('product');
  const { ref: sectionRef, isInView } = useScrollAnimation({ once: true, amount: 0.2 });

  const problems = [
    {
      icon: FileText,
      title: t('problem.pain1.title'),
      desc: t('problem.pain1.desc'),
      impact: t('problem.pain1.impact'),
    },
    {
      icon: Search,
      title: t('problem.pain2.title'),
      desc: t('problem.pain2.desc'),
      impact: t('problem.pain2.impact'),
    },
    {
      icon: Shield,
      title: t('problem.pain3.title'),
      desc: t('problem.pain3.desc'),
      impact: t('problem.pain3.impact'),
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <section ref={sectionRef} className={styles.section} id="problem">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <motion.h2
            className={styles.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
          >
            {t('problem.title')}
          </motion.h2>
          <motion.p
            className={styles.subtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
          >
            {t('problem.subtitle')}
          </motion.p>
        </div>

        {/* Grid */}
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <motion.div
                key={index}
                className={styles.card}
                variants={cardVariants}
                whileHover={{
                  y: -10,
                  transition: { type: 'spring', stiffness: 300 }
                }}
              >
                <div className={styles.iconWrapper}>
                  <Icon size={32} strokeWidth={1.5} />
                </div>

                <div className={styles.content}>
                  <h3 className={styles.cardTitle}>{problem.title}</h3>
                  <p className={styles.cardDesc}>{problem.desc}</p>
                </div>

                <div className={styles.impact}>
                  <AlertTriangle className={styles.impactIcon} size={16} />
                  <span>{problem.impact}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
