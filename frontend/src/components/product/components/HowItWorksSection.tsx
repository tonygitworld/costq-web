import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Table2, GitBranch } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './HowItWorksSection.module.css';

export const HowItWorksSection: React.FC = () => {
  const { t } = useI18n(['product', 'common']);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'agentic',
      icon: Bot,
      title: t('product:capabilities.step1.title'),
      desc: t('product:capabilities.step1.desc'),
      // 请将您的图1/2重命名为 agent-workflow.png 并放入 public/images/features/
      image: '/images/features/agent-workflow.png'
    },
    {
      id: 'cost_tracking',
      icon: Table2,
      title: t('product:capabilities.step2.title'),
      desc: t('product:capabilities.step2.desc'),
      // 请将您的图3重命名为 cost-tracking.png 并放入 public/images/features/
      image: '/images/features/cost-tracking.png'
    },
    {
      id: 'decision',
      icon: GitBranch,
      title: t('product:capabilities.step3.title'),
      desc: t('product:capabilities.step3.desc'),
      // 请将您的图4/6重命名为 decision-logic.png 并放入 public/images/features/
      image: '/images/features/decision-logic.png'
    }
  ];

  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.preTitle}>{t('product:capabilities.preTitle')}</div>
          <h2 className={styles.title}>{t('product:capabilities.title')}</h2>
        </div>

        <div className={styles.content}>
          {/* Left: Navigation */}
          <div className={styles.stepsNav}>
            {steps.map((step, index) => (
              <div
                key={index}
                className={`${styles.stepItem} ${activeStep === index ? styles.active : ''}`}
                onClick={() => setActiveStep(index)}
              >
                <div className={styles.stepHeader}>
                  <step.icon size={20} className={activeStep === index ? styles.activeIcon : styles.inactiveIcon} />
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                </div>
                {activeStep === index && (
                  <motion.div
                    className={styles.stepDescWrapper}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <p className={styles.stepDesc}>{step.desc}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Image Display */}
          <div className={styles.visualArea}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                className={styles.imageWrapper}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={steps[activeStep].image}
                  alt={steps[activeStep].title}
                  className={styles.featureImage}
                  onError={(e) => {
                    // Fallback visual if image missing
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.classList.add(styles.imageFallback);
                    e.currentTarget.parentElement!.innerHTML = `<div class="${styles.fallbackText}">请上传图片: ${steps[activeStep].image}</div>`;
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
