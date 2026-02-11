import React, { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown, Lock, CreditCard, Cloud, BarChart, Users, RefreshCw } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './FAQSection.module.css';

interface FAQ {
  icon: typeof Lock;
  iconColor: string;
  question: string;
  answer: string;
}

export const FAQSection: React.FC = () => {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(0); // 默认展开第一个
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });

  const faqs: FAQ[] = [
    {
      icon: Lock,
      iconColor: '#EF4444',
      question: 'CostQ 会访问我的云资源吗？',
      answer:
        '不会。CostQ 仅需要只读 API 权限，通过 IAM Role 授权，只能查看账单数据，无法修改、删除任何云资源。您可以随时在 AWS Console 撤销权限。',
    },
    {
      icon: CreditCard,
      iconColor: '#F59E0B',
      question: '免费版有使用期限吗？',
      answer:
        '没有。免费版永久免费，支持 2 个云账号，包含基础 AI 对话查询和每日成本摘要功能。如需更多账号或高级功能，可随时升级到专业版。',
    },
    {
      icon: Cloud,
      iconColor: '#3B82F6',
      question: '支持哪些云平台？',
      answer:
        '目前支持 AWS 和 GCP，Azure 支持正在开发中（预计 Q2 上线）。AWS 支持所有区域，GCP 支持 BigQuery Billing Export。',
    },
    {
      icon: BarChart,
      iconColor: '#8B5CF6',
      question: '数据多久同步一次？',
      answer:
        '成本数据每 15 分钟同步一次（AWS Cost Explorer 限制），告警检测每日 7:00 自动执行，异常情况实时推送通知。',
    },
    {
      icon: Users,
      iconColor: '#10B981',
      question: '提供技术支持吗？',
      answer:
        '免费版：社区支持（文档 + FAQ）\n专业版：邮件支持（24 小时响应）\n企业版：专属客户成功经理 + Slack 群组支持',
    },
    {
      icon: RefreshCw,
      iconColor: '#EC4899',
      question: '可以随时取消订阅吗？',
      answer:
        '可以。专业版支持随时取消，已付费用按天数比例退款。企业版合同到期前 30 天需提前通知。',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section ref={sectionRef} className={styles.section} id="faq">
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
            常见问题
          </motion.div>
          <h2 className={styles.title}>解答您关心的核心问题</h2>
          <p className={styles.subtitle}>快速了解 CostQ 的功能、安全和支持</p>
        </motion.div>

        {/* FAQ List */}
        <div className={styles.faqList}>
          {faqs.map((faq, index) => {
            const Icon = faq.icon;
            const isOpen = openIndex === index;

            return (
              <motion.div
                key={index}
                className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + index * 0.08 }}
              >
                {/* Question Button */}
                <button
                  className={styles.question}
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                >
                  <div className={styles.questionLeft}>
                    <div
                      className={styles.iconWrapper}
                      style={{ backgroundColor: `${faq.iconColor}15` }}
                    >
                      <Icon size={20} strokeWidth={2} color={faq.iconColor} />
                    </div>
                    <span className={styles.questionText}>{faq.question}</span>
                  </div>
                  <motion.div
                    className={styles.toggle}
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                  >
                    <ChevronDown size={24} strokeWidth={2} color="#6B7280" />
                  </motion.div>
                </button>

                {/* Answer - 折叠动画 */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      className={styles.answer}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] },
                        opacity: { duration: 0.2, ease: 'easeInOut' },
                      }}
                    >
                      <div className={styles.answerContent}>
                        {faq.answer.split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Progress bar - 视觉反馈 */}
                {isOpen && (
                  <motion.div
                    className={styles.progressBar}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{ backgroundColor: faq.iconColor }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Contact Support CTA */}
        <motion.div
          className={styles.contactSupport}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
        >
          <div className={styles.supportIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="#3B82F6" strokeWidth="2" />
              <path
                d="M16 10v6M16 22v.5"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className={styles.supportText}>没有找到答案？</p>
          <motion.a
            href="/support"
            className={styles.supportLink}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            联系技术支持
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
        </motion.div>
      </div>

      {/* Background decorations */}
      <div className={styles.bgDecoration}>
        <div className={styles.wave1} />
        <div className={styles.wave2} />
      </div>
    </section>
  );
};
