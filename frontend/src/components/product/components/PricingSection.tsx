import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './PricingSection.module.css';

interface PricingPlan {
  name: string;
  badge?: string;
  price: string | number;
  period?: string;
  features: Array<{ text: string; included: boolean }>;
  cta: string;
  ctaLink: string;
  featured?: boolean;
  trust?: string;
  gradient: string;
}

export const PricingSection: React.FC = () => {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });

  const plans: PricingPlan[] = [
    {
      name: '个人试用',
      price: '免费',
      period: '永久',
      features: [
        { text: '支持 2 个云账号', included: true },
        { text: '基础 AI 对话查询', included: true },
        { text: '每日成本摘要邮件', included: true },
        { text: 'RI/SP 优化建议', included: false },
        { text: '自定义告警规则', included: false },
      ],
      cta: '免费注册',
      ctaLink: '/signup',
      // gradient 已移除（简化配色）
      },
    {
      name: '专业版',
      badge: '最受欢迎',
      price: 99,
      period: '/月',
      features: [
        { text: '支持 10 个云账号', included: true },
        { text: '完整 AI 对话功能', included: true },
        { text: 'RI/SP 优化建议', included: true },
        { text: '自定义告警规则（5条）', included: true },
        { text: 'Slack/Webhook 通知', included: true },
        { text: '优先技术支持', included: true },
      ],
      cta: '立即购买',
      ctaLink: '/signup?plan=pro',
      featured: true,
      trust: '7 天无理由退款',
      // gradient 已移除（简化配色）
      },
    {
      name: '企业版',
      badge: '企业定制',
      price: '联系销售',
      features: [
        { text: '无限云账号', included: true },
        { text: '所有专业版功能', included: true },
        { text: '自定义告警规则（无限）', included: true },
        { text: 'SSO 单点登录', included: true },
        { text: '专属客户成功经理', included: true },
        { text: 'SLA 保障', included: true },
      ],
      cta: '联系销售',
      ctaLink: '/contact-sales',
      // gradient 已移除（简化配色）
      },
  ];

  const faqs = [
    {
      question: '可以按年付费吗？',
      answer: '可以，年付享 8.5 折优惠（相当于 10.2 个月价格）',
    },
    {
      question: '支持哪些支付方式？',
      answer: '支持信用卡、PayPal、企业对公转账',
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
      y: 60,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 80,
        damping: 15,
      },
    },
  };

  return (
    <section ref={sectionRef} className={styles.section} id="pricing">
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
            定价方案
          </motion.div>
          <h2 className={styles.title}>灵活的定价方案</h2>
          <p className={styles.subtitle}>从免费试用到企业定制，满足不同规模需求</p>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              className={`${styles.card} ${plan.featured ? styles.cardFeatured : ''}`}
              variants={cardVariants}
              whileHover={{
                y: plan.featured ? -16 : -12,
                scale: 1.02,
                transition: { duration: 0.3 },
              }}
              style={{
                '--gradient': plan.gradient,
              } as React.CSSProperties}
            >
              {/* Badge */}
              {plan.badge && (
                <div
                  className={`${styles.badge} ${plan.featured ? styles.badgeFeatured : ''}`}
                  style={{ background: plan.gradient }}
                >
                  {plan.featured && <Sparkles size={14} strokeWidth={2.5} />}
                  <span>{plan.badge}</span>
                </div>
              )}

              {/* Plan Name */}
              <h3 className={styles.planName}>{plan.name}</h3>

              {/* Price */}
              <div className={styles.priceWrapper}>
                {typeof plan.price === 'number' ? (
                  <>
                    <span className={styles.currency}>$</span>
                    <span className={styles.price}>{plan.price}</span>
                    {plan.period && <span className={styles.period}>{plan.period}</span>}
                  </>
                ) : (
                  <span className={styles.priceCustom}>{plan.price}</span>
                )}
              </div>

              {/* Features */}
              <ul className={styles.features}>
                {plan.features.map((feature, idx) => (
                  <motion.li
                    key={idx}
                    className={feature.included ? styles.featureIncluded : styles.featureExcluded}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.4 + index * 0.1 + idx * 0.05 }}
                  >
                    <div className={styles.featureIcon}>
                      {feature.included ? (
                        <Check size={18} strokeWidth={3} color="#10B981" />
                      ) : (
                        <X size={18} strokeWidth={3} color="#EF4444" />
                      )}
                    </div>
                    <span>{feature.text}</span>
                  </motion.li>
                ))}
              </ul>

              {/* CTA Button */}
              <motion.a
                href={plan.ctaLink}
                className={`${styles.ctaButton} ${plan.featured ? styles.ctaButtonFeatured : ''}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {plan.cta}
                <ArrowRight size={18} strokeWidth={2.5} />
              </motion.a>

              {/* Trust Badge */}
              {plan.trust && (
                <div className={styles.trust}>
                  <Check size={14} strokeWidth={3} color="#10B981" />
                  <span>{plan.trust}</span>
                </div>
              )}

              {/* Decorative gradient border (featured only) */}
              {plan.featured && <div className={styles.featuredBorder} />}
            </motion.div>
          ))}
        </motion.div>

        {/* FAQ - 内嵌定价常见问题 */}
        <motion.div
          className={styles.faq}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
        >
          <h3 className={styles.faqTitle}>定价常见问题</h3>
          <div className={styles.faqGrid}>
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                className={styles.faqItem}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.9 + index * 0.1 }}
              >
                <div className={styles.faqQuestion}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="#3B82F6" strokeWidth="2" />
                    <path d="M10 6v4M10 14v.5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>{faq.question}</span>
                </div>
                <div className={styles.faqAnswer}>{faq.answer}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Background decorations */}
      <div className={styles.bgDecoration}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>
    </section>
  );
};
