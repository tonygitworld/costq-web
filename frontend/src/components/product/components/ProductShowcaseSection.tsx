import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { MessageSquareText, FileBarChart, Sparkles, DatabaseZap, Workflow, BellRing, BrainCircuit, Bot, Smartphone } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './ProductShowcaseSection.module.css';

export const ProductShowcaseSection: React.FC = () => {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  // 9个核心能力 - 基于图片文案
  const features = [
    {
      icon: MessageSquareText,
      title: '交互简单',
      desc: '自然语言交互打破技术复杂度，实现真正的跨部门协作。',
    },
    {
      icon: FileBarChart,
      title: '成本分析报告',
      desc: '随时获取成本分析报告。',
    },
    {
      icon: Sparkles,
      title: '数据洞察能力',
      desc: '从静态数据统计到智能洞察的转变。',
    },
    {
      icon: DatabaseZap,
      title: '数据准确可靠',
      desc: '所有数据基于云成本服务官方服务接口的实时数据。',
    },
    {
      icon: Workflow,
      title: '并行工具调用',
      desc: '迅速返回结果，提升查询效率。',
    },
    {
      icon: BellRing,
      title: '灵活告警设置',
      desc: '自然语言设置告警，监控维度无限扩展，持续进行成本监控和报告发送。',
    },
    {
      icon: BrainCircuit,
      title: '记忆',
      desc: '短期记忆记住对话历史，无需重复提问；长期记忆记住用户角色，个性化数据展示。',
    },
    {
      icon: Bot,
      title: '预留实例管理自动化',
      desc: '根据利用率、覆盖率自动决定购买策略并执行。',
    },
    {
      icon: Smartphone,
      title: '移动端友好',
      desc: '自然语言交互方式让移动端查询更便捷。',
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
          <h2 className={styles.title}>CostQ 是一个什么样的平台</h2>
          <p className={styles.subtitle}>专为降本增效打造的智能云成本管理专家</p>
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
