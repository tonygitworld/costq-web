import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Quote, TrendingUp } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './TestimonialsSection.module.css';

export const TestimonialsSection: React.FC = () => {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });

  const testimonials = [
    {
      quote: '首日发现 7 个未使用负载均衡器，每月节省 $600。CostQ 的告警准确率比我们之前用的工具高太多了。',
      author: '张伟',
      role: '云架构师',
      company: '某游戏科技（已获授权）',
      highlight: '首月节省 $600',
      highlightIcon: '💰',
      // gradient 已移除（简化配色）
      },
    {
      quote: '财务团队原本每月花 2 天时间手动分摊成本，现在 CostQ 自动生成报表，只需 2 小时审核。',
      author: '李娜',
      role: '财务总监',
      company: '某 SaaS 公司（已获授权）',
      highlight: '效率提升 90%（2天→2小时）',
      highlightIcon: '⚡',
      // gradient 已移除（简化配色）
      },
    {
      quote: '之前需要专人盯着成本异常，现在 CostQ 自动告警，团队可以专注于业务优化。',
      author: '王强',
      role: '运维负责人',
      company: '某电商平台（已获授权）',
      highlight: '节省 1 个人力',
      highlightIcon: '🎯',
      // gradient 已移除（简化配色）
      },
  ];

  return (
    <section ref={sectionRef} id="testimonials" className={styles.section}>
      <div className={styles.container}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <h2 className={styles.title}>客户真实反馈</h2>
          <p className={styles.subtitle}>来自 150+ 企业的实际使用数据</p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className={styles.grid}>
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className={styles.card}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.2 + index * 0.15,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
              whileHover={{
                y: -8,
                transition: { duration: 0.3 },
              }}
            >
              {/* Quote Icon */}
              <Quote className={styles.quoteIcon} size={36} strokeWidth={1.5} />

              {/* Quote Text */}
              <p className={styles.quote}>{testimonial.quote}</p>

              {/* Author Info */}
              <div className={styles.author}>
                {/* Avatar Placeholder */}
                <div className={styles.avatar}>
                  <div className={styles.avatarPlaceholder}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="12" r="6" fill="#9CA3AF" />
                      <path
                        d="M8 26c0-4.418 3.582-8 8-8s8 3.582 8 8"
                        fill="#9CA3AF"
                      />
                    </svg>
                  </div>
                </div>

                {/* Info */}
                <div className={styles.info}>
                  <div className={styles.name}>{testimonial.author}</div>
                  <div className={styles.role}>{testimonial.role}</div>
                  <div className={styles.company}>{testimonial.company}</div>
                </div>
              </div>

              {/* Highlight Badge */}
              <div
                className={styles.highlight}
                style={{ background: testimonial.gradient }}
              >
                <span className={styles.highlightIcon}>{testimonial.highlightIcon}</span>
                <span>{testimonial.highlight}</span>
              </div>

              {/* Decorative gradient */}
              <div
                className={styles.cardGradient}
                style={{ background: testimonial.gradient }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
