import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Table2, GitBranch } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './HowItWorksSection.module.css';

export const HowItWorksSection: React.FC = () => {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'agentic',
      icon: Bot,
      title: 'Agentic 智能治理',
      desc: '只需一句自然语言，Agent 即可自主拆解任务。从意图理解、工具调用到最终执行，全流程自动化闭环。支持复杂的逻辑推理与多工具协同。',
      // 请将您的图1/2重命名为 agent-workflow.png 并放入 public/images/features/
      image: '/images/features/agent-workflow.png'
    },
    {
      id: 'cost_tracking',
      icon: Table2,
      title: '成本精准透视',
      desc: '深入资源底层的成本追踪能力。精确解析 Amazon Bedrock 等复杂服务的内部构成，让每一分云支出的去向都清晰可见。',
      // 请将您的图3重命名为 cost-tracking.png 并放入 public/images/features/
      image: '/images/features/cost-tracking.png'
    },
    {
      id: 'decision',
      icon: GitBranch,
      title: '多维智能告警',
      desc: '告别死板的固定阈值。基于 AI 语义理解实现动态监控，监控维度无限扩展。决策逻辑全透明展示，智能判断复杂触发条件。',
      // 请将您的图4/6重命名为 decision-logic.png 并放入 public/images/features/
      image: '/images/features/decision-logic.png'
    }
  ];

  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.preTitle}>深度解析</div>
          <h2 className={styles.title}>Agentic AI 核心能力</h2>
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
