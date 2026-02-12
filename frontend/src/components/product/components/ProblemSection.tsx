import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FileText, Search, Shield } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ProblemSection.module.css';

export const ProblemSection: React.FC = () => {
  const { t } = useI18n('product');
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const problems = [
    {
      number: '01',
      icon: FileText,
      iconColor: '#2563EB',
      title: t('problem.pain1.title'),
      desc: t('problem.pain1.desc'),
    },
    {
      number: '02',
      icon: Search,
      iconColor: '#1d4ed8',
      title: t('problem.pain2.title'),
      desc: t('problem.pain2.desc'),
    },
    {
      number: '03',
      icon: Shield,
      iconColor: '#1e40af',
      title: t('problem.pain3.title'),
      desc: t('problem.pain3.desc'),
    },
  ];

  // 容器动画变体
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  // 卡片动画变体（优化：更流畅的物理效果）
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.97,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 80,
        damping: 12,
        mass: 0.6,
      },
    },
  };

  return (
    <section ref={sectionRef} className={styles.section} id="problem">
      <div className={styles.container}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <motion.div
            className={styles.preTitle}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {t('problem.preTitle')}
          </motion.div>
          <h2 className={styles.title}>{t('problem.title')}</h2>
          <p className={styles.subtitle}>{t('problem.subtitle')}</p>
        </motion.div>

        {/* Pain Points Grid */}
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
                  y: -4,
                  transition: { duration: 0.2, ease: 'easeOut' },
                }}
              >
                {/* Icon */}
                <motion.div
                  className={styles.iconWrapper}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={styles.iconBg}>
                    <Icon size={28} strokeWidth={2} />
                  </div>
                </motion.div>

                {/* Content */}
                <div className={styles.content}>
                  <h3 className={styles.cardTitle}>{problem.title}</h3>
                  <p className={styles.cardDesc}>{problem.desc}</p>
                </div>

                {/* Decorative line */}
                <div className={styles.decorativeLine} />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
