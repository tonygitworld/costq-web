import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Clock, Shield, Users } from 'lucide-react';
import styles from './StatsSection.module.css';

const stats = [
  {
    icon: <TrendingDown size={24} />,
    value: '35%',
    label: '平均成本降低',
    desc: '客户平均节省',
  },
  {
    icon: <Clock size={24} />,
    value: '30秒',
    label: '快速接入',
    desc: '无需复杂配置',
  },
  {
    icon: <Shield size={24} />,
    value: '99.9%',
    label: '服务可用性',
    desc: '企业级稳定性',
  },
  {
    icon: <Users size={24} />,
    value: '500+',
    label: '企业客户',
    desc: '信赖之选',
  },
];

export const StatsSection: React.FC = () => {
  return (
    <section className={styles.stats}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className={styles.statCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className={styles.icon}>{stat.icon}</div>
              <div className={styles.value}>{stat.value}</div>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.desc}>{stat.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
