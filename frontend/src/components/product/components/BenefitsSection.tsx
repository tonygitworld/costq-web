import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { DollarSign, Zap, Target, Shield } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './BenefitsSection.module.css';

export const BenefitsSection: React.FC = () => {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });

  const benefits = [
    {
      icon: DollarSign,
      value: '降低成本 35%',
      desc: '平均 7 天内发现首个优化机会，月度节省 $5,000+',
      dataSource: '基于 AWS 月均支出 $50k 的企业',
      // gradient 已移除（简化配色）
      iconBg: '#10B981',
      glowColor: 'rgba(16, 185, 129, 0.25)',
      pattern: 'dollar',
    },
    {
      icon: Zap,
      value: '效率提升 90%',
      desc: '从人工分析 2 天 → AI 分析 5 分钟',
      dataSource: '某SaaS公司财务团队从每月 16 人时 → 2 人时',
      // gradient 已移除（简化配色）
      iconBg: '#F59E0B',
      glowColor: 'rgba(245, 158, 11, 0.25)',
      pattern: 'lightning',
    },
    {
      icon: Target,
      value: '告警准确率 95%',
      desc: '告警规则基于历史数据训练，误报率 < 5%',
      dataSource: '某电商平台每月减少 50+ 条无效告警',
      // gradient 已移除（简化配色）
      iconBg: '#8B5CF6',
      glowColor: 'rgba(139, 92, 246, 0.25)',
      pattern: 'target',
    },
    {
      icon: Shield,
      value: '零风险接入',
      desc: '只读 API 权限，不会修改任何云资源',
      dataSource: '通过 IAM Role 最小权限原则，仅授予账单查看权限',
      // gradient 已移除（简化配色）
      iconBg: '#3B82F6',
      glowColor: 'rgba(59, 130, 246, 0.25)',
      pattern: 'shield',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 50,
      scale: 0.9,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        mass: 0.8,
      },
    },
  };

  // 渲染背景图案
  const renderPattern = (pattern: string, color: string) => {
    switch (pattern) {
      case 'dollar':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" className={styles.pattern}>
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="80" fill={color} opacity="0.06">$</text>
          </svg>
        );
      case 'lightning':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" className={styles.pattern}>
            <path d="M60 20L40 70h20l-10 30 30-50H60l10-30z" fill={color} opacity="0.06" />
          </svg>
        );
      case 'target':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" className={styles.pattern}>
            <circle cx="60" cy="60" r="40" fill="none" stroke={color} strokeWidth="2" opacity="0.06" />
            <circle cx="60" cy="60" r="25" fill="none" stroke={color} strokeWidth="2" opacity="0.06" />
            <circle cx="60" cy="60" r="10" fill={color} opacity="0.06" />
          </svg>
        );
      case 'shield':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" className={styles.pattern}>
            <path d="M60 20 L90 35 L90 65 Q90 85 60 100 Q30 85 30 65 L30 35 Z" fill="none" stroke={color} strokeWidth="2" opacity="0.06" />
            <path d="M50 60 L57 67 L70 50" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.08" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <section ref={sectionRef} className={styles.section} id="benefits">
      <div className={styles.container}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <motion.div
            className={styles.preTitle}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            实际收益
          </motion.div>
          <h2 className={styles.title}>CostQ 带来的价值</h2>
          <p className={styles.subtitle}>数据来自 150+ 企业客户真实反馈</p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={index}
                className={styles.card}
                variants={cardVariants}
                whileHover={{
                  y: -12,
                  scale: 1.03,
                  transition: { duration: 0.3 },
                }}
                style={{
                  '--glow-color': benefit.glowColor,
                } as React.CSSProperties}
              >
                {/* Background Pattern */}
                <div className={styles.patternWrapper}>
                  {renderPattern(benefit.pattern, benefit.iconBg)}
                </div>

                {/* Icon */}
                <motion.div
                  className={styles.iconWrapper}
                  whileHover={{
                    scale: 1.1,
                    rotate: [0, -5, 5, -5, 0],
                    transition: { duration: 0.5 }
                  }}
                >
                  <div
                    className={styles.iconBg}
                    style={{ background: benefit.gradient }}
                  >
                    <Icon size={32} strokeWidth={2.5} color="white" />
                  </div>
                  {/* Glow effect */}
                  <div
                    className={styles.iconGlow}
                    style={{ backgroundColor: benefit.iconBg }}
                  />
                </motion.div>

                {/* Content */}
                <div className={styles.content}>
                  {/* Value - 大标题 */}
                  <motion.h3
                    className={styles.value}
                    style={{
                      background: benefit.gradient,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    {benefit.value}
                  </motion.h3>

                  {/* Description */}
                  <p className={styles.desc}>{benefit.desc}</p>

                  {/* Data Source - 带图标 */}
                  <motion.div
                    className={styles.dataSource}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className={styles.sourceIcon}
                    >
                      <circle cx="8" cy="8" r="7" stroke={benefit.iconBg} strokeWidth="1.5" opacity="0.3" />
                      <path d="M8 5v6M8 3v1" stroke={benefit.iconBg} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>{benefit.dataSource}</span>
                  </motion.div>
                </div>

                {/* Decorative gradient line */}
                <div
                  className={styles.gradientLine}
                  style={{ background: benefit.gradient }}
                />

                {/* Hover glow effect */}
                <div className={styles.hoverGlow} />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className={styles.bottomCta}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1 }}
        >
          <div className={styles.ctaContent}>
            <h3>准备好体验这些收益了吗？</h3>
            <p>免费接入，2 分钟完成配置，7 天内看到优化效果</p>
            <motion.a
              href="/signup"
              className={styles.ctaButton}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              立即开始免费试用
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 10h10M10 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.a>
          </div>
        </motion.div>
      </div>

      {/* Background decorations */}
      <div className={styles.bgDecoration}>
        <div className={styles.mesh1} />
        <div className={styles.mesh2} />
      </div>
    </section>
  );
};
