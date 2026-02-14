import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { CheckCircle2, CircleDashed, Loader2, Eye, Brain, Zap } from 'lucide-react';
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
        {/* 连接线背景 */}
        <div className={styles.lineBase}>
           {/* 动态进度条 */}
           <motion.div
             className={styles.lineProgress}
             initial={{ width: 0 }}
             animate={isInView ? { width: '50%' } : {}}
             transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
           />
        </div>

        <div className={styles.stepsContainer}>
          {roadmapSteps.map((step, index) => (
            <motion.div
              key={index}
              className={`${styles.step} ${styles[step.status]}`}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + index * 0.2 }}
            >
              {/* 节点图标 */}
              <div className={styles.iconWrapper}>
                {/* 优先显示自定义图标，如果没有则显示状态图标 */}
                <step.icon size={28} className={styles[`icon${step.status.charAt(0).toUpperCase() + step.status.slice(1)}`]} />
              </div>

              {/* 内容卡片 */}
              <div className={styles.card}>
                <div className={styles.phaseBadge}>{step.phase}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <ul className={styles.featureList}>
                  {step.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                <div className={styles.date}>{step.date}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
