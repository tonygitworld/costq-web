import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Table2, GitBranch } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './HowItWorksSection.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.21, 0.47, 0.32, 0.98]
    }
  }
};

export const HowItWorksSection: React.FC = () => {
  const { t } = useI18n(['product', 'common']);

  const capabilities = [
    {
      id: 'agentic',
      icon: Bot,
      title: t('product:capabilities.step1.title'),
      desc: t('product:capabilities.step1.desc'),
      theme: 'blue'
    },
    {
      id: 'cost_tracking',
      icon: Table2,
      title: t('product:capabilities.step2.title'),
      desc: t('product:capabilities.step2.desc'),
      theme: 'indigo'
    },
    {
      id: 'decision',
      icon: GitBranch,
      title: t('product:capabilities.step3.title'),
      desc: t('product:capabilities.step3.desc'),
      theme: 'purple'
    }
  ];

  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <motion.div
            className={styles.preTitle}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {t('product:capabilities.preTitle')}
          </motion.div>
          <motion.h2
            className={styles.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {t('product:capabilities.title')}
          </motion.h2>
        </div>

        <motion.div
          className={styles.cardGrid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {capabilities.map((item) => (
            <motion.div
              key={item.id}
              className={styles.card}
              variants={itemVariants}
              data-theme={item.theme}
            >
              <div className={styles.cardGlow} />
              <div className={styles.cardInner}>
                <div className={styles.iconWrapper}>
                  <item.icon size={28} strokeWidth={1.5} />
                </div>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
