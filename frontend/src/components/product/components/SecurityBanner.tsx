import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Cloud, KeyRound } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './SecurityBanner.module.css';

export const SecurityBanner: React.FC = () => {
  const { t } = useI18n();

  const securityItems = [
    {
      icon: <Shield size={36} strokeWidth={1.5} />,
      label: t('product:security.item1'),
      color: '#667EEA',
    },
    {
      icon: <Lock size={36} strokeWidth={1.5} />,
      label: t('product:security.item2'),
      color: '#F093FB',
    },
    {
      icon: <Cloud size={36} strokeWidth={1.5} />,
      label: t('product:security.item3'),
      color: '#4FACFE',
    },
    {
      icon: <KeyRound size={36} strokeWidth={1.5} />,
      label: t('product:security.item4'),
      color: '#F59E0B',
    },
  ];

  return (
    <section id="security" className={styles.section}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <h2 className={styles.title}>{t('product:security.title')}</h2>
          <p className={styles.subtitle}>{t('product:security.subtitle')}</p>
        </motion.div>

        <div className={styles.grid}>
          {securityItems.map((item, index) => (
            <motion.div
              key={index}
              className={styles.card}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
            >
              <div className={styles.icon} style={{ color: item.color }}>
                {item.icon}
              </div>
              <div className={styles.label}>{item.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
