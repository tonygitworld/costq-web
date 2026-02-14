import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { MessageSquareText, FileBarChart, Sparkles, DatabaseZap, Workflow, BellRing, BrainCircuit, Bot, Smartphone } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ProductShowcaseSection.module.css';

export const ProductShowcaseSection: React.FC = () => {
  const { t } = useI18n(['product', 'common']);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  // 9个核心能力 - 基于图片文案
  const features = [
    {
      icon: MessageSquareText,
      title: t('product:showcase.feature1.title'),
      desc: t('product:showcase.feature1.desc'),
    },
    {
      icon: FileBarChart,
      title: t('product:showcase.feature2.title'),
      desc: t('product:showcase.feature2.desc'),
    },
    {
      icon: Sparkles,
      title: t('product:showcase.feature3.title'),
      desc: t('product:showcase.feature3.desc'),
    },
    {
      icon: DatabaseZap,
      title: t('product:showcase.feature4.title'),
      desc: t('product:showcase.feature4.desc'),
    },
    {
      icon: Workflow,
      title: t('product:showcase.feature5.title'),
      desc: t('product:showcase.feature5.desc'),
    },
    {
      icon: BellRing,
      title: t('product:showcase.feature6.title'),
      desc: t('product:showcase.feature6.desc'),
    },
    {
      icon: BrainCircuit,
      title: t('product:showcase.feature7.title'),
      desc: t('product:showcase.feature7.desc'),
    },
    {
      icon: Bot,
      title: t('product:showcase.feature8.title'),
      desc: t('product:showcase.feature8.desc'),
    },
    {
      icon: Smartphone,
      title: t('product:showcase.feature9.title'),
      desc: t('product:showcase.feature9.desc'),
    },
  ];

  // 容器动画变体
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  // 卡片动画变体
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.95,
    },
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
    <section ref={sectionRef} id="product-showcase" className={styles.section}>
      <div className={styles.container}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <h2 className={styles.title}>{t('product:showcase.title')}</h2>
          <p className={styles.subtitle}>{t('product:showcase.subtitle')}</p>
        </motion.div>

        {/* Features Grid - 3x3 */}
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                className={styles.card}
                variants={cardVariants}
                whileHover={{
                  y: -6,
                  transition: { duration: 0.2 },
                }}
              >
                <div className={styles.iconWrapper}>
                  <Icon size={24} strokeWidth={1.5} />
                </div>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDesc}>{feature.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
