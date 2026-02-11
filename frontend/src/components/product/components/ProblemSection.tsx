import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FileText, Search, Shield } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ProblemSection.module.css';

export const ProblemSection: React.FC = () => {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const problems = [
    {
      icon: FileText,
      iconColor: '#2563EB',
      title: '账单复杂，理解困难',
      desc: '公有云账单充斥着复杂的技术术语和参数，即使是技术人员，也很难进行全面的成本分析。',
      impact: '财务人员需要依赖技术团队解读账单，沟通成本高',
    },
    {
      icon: Search,
      iconColor: '#1d4ed8',
      title: '缺少深入洞察',
      desc: '现有工具大多停留在"统计"层面，只能告诉你上个月花了多少钱、哪些服务成本最高。没有对于数据的分析和洞察。',
      impact: '无法定位成本异常根因，优化无从下手',
    },
    {
      icon: Shield,
      iconColor: '#1e40af',
      title: '缺乏有效的成本治理',
      desc: '成本优化考虑不全面，无法持续进行成本治理。',
      impact: '资源浪费持续发生，月度超支成为常态',
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

  // 卡片动画变体（Pro Max: 多维度动画）
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 40,
      scale: 0.95,
      rotateX: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        mass: 0.8,
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
            痛点分析
          </motion.div>
          <h2 className={styles.title}>云账单的三个真相</h2>
          <p className={styles.subtitle}>传统成本管理方式已经失效</p>
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
                  y: -8,
                  scale: 1.02,
                  transition: { duration: 0.3 },
                }}
              >
                {/* Icon */}
                <motion.div
                  className={styles.iconWrapper}
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={styles.iconBg}>
                    <Icon size={28} strokeWidth={2} />
                  </div>
                </motion.div>

                {/* Content */}
                <div className={styles.content}>
                  <h3 className={styles.cardTitle}>{problem.title}</h3>
                  <p className={styles.cardDesc}>{problem.desc}</p>

                  {/* Impact - 重点突出 */}
                  <motion.div
                    className={styles.impact}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className={styles.arrow}
                    >
                      <path
                        d="M1 8h14M8 1l7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{problem.impact}</span>
                  </motion.div>
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
