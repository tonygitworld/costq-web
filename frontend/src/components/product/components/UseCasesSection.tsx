import React, { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Briefcase, Code, Wrench, ChevronRight } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import styles from './UseCasesSection.module.css';

type Role = '财务' | '研发' | '运维';

interface UseCase {
  role: Role;
  icon: typeof Briefcase;
  iconColor: string;
  title: string;
  challenge: string;
  features: string[];
  result: string;
  gradient: string;
}

export const UseCasesSection: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Role>('财务');
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });

  const useCases: UseCase[] = [
    {
      role: '财务',
      icon: Briefcase,
      iconColor: '#2563EB',
      title: '财务部门：精准核算各项目云成本',
      challenge: '每月需要手动分摊云成本到各业务线，耗时 2 天+',
      features: [
        '自动按标签归因成本（Project/Environment/Team）',
        '生成财务级报表，支持导出 Excel/PDF',
        '跨账号成本汇总，多云统一视图',
      ],
      result: '某 SaaS 公司：从每月 16 人时 → 2 人时，节省 87.5% 时间',
      // gradient 已移除（简化配色）
      },
    {
      role: '研发',
      icon: Code,
      iconColor: '#2563EB',
      title: '研发团队：快速定位高成本服务',
      challenge: '不知道哪个微服务最贵，无法针对性优化',
      features: [
        '自然语言查询「哪个服务费用最高？」',
        '自动生成服务成本排行榜',
        '提供优化建议（如：切换实例类型、启用 Spot）',
      ],
      result: '某电商平台：发现某个服务占 40% 成本，优化后降低 60%',
      // gradient 已移除（简化配色）
      },
    {
      role: '运维',
      icon: Wrench,
      iconColor: '#2563EB',
      title: '运维团队：实时监控避免资源浪费',
      challenge: '资源浪费（闲置实例/未挂载磁盘）发现滞后 15 天',
      features: [
        '每日自动扫描闲置资源',
        '实时告警推送到 Slack/邮件',
        '提供具体操作指令（如：删除 EBS vol-xxx）',
      ],
      result: '某游戏公司：首日发现 7 个未使用负载均衡器，节省 $600/月',
      // gradient 已移除（简化配色）
      },
  ];

  const activeUseCase = useCases.find((uc) => uc.role === activeTab) || useCases[0];

  return (
    <section ref={sectionRef} className={styles.section} id="use-cases">
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
            应用场景
          </motion.div>
          <h2 className={styles.title}>不同团队的使用场景</h2>
          <p className={styles.subtitle}>一个平台，服务三个角色</p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          className={styles.tabNav}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
        >
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon;
            const isActive = activeTab === useCase.role;
            return (
              <motion.button
                key={useCase.role}
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(useCase.role)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div
                  className={styles.tabIcon}
                  style={{
                    background: isActive ? useCase.gradient : 'transparent',
                    color: isActive ? 'white' : useCase.iconColor,
                  }}
                >
                  <Icon size={24} strokeWidth={2} />
                </div>
                <span>{useCase.role}</span>
                {isActive && (
                  <motion.div
                    className={styles.activeIndicator}
                    layoutId="activeTab"
                    style={{ background: useCase.gradient }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className={styles.scenario}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              {/* Title */}
              <div className={styles.scenarioTitle}>
                <div
                  className={styles.titleIcon}
                  style={{ background: activeUseCase.gradient }}
                >
                  {React.createElement(activeUseCase.icon, { size: 28, strokeWidth: 2, color: 'white' })}
                </div>
                <h3>{activeUseCase.title}</h3>
              </div>

              {/* Three Columns */}
              <div className={styles.columns}>
                {/* Column 1: Challenge */}
                <motion.div
                  className={styles.column}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.columnBadge} style={{ background: '#EF4444' }}>
                      当前挑战
                    </div>
                  </div>
                  <div className={styles.columnContent}>
                    <p className={styles.challengeText}>{activeUseCase.challenge}</p>
                  </div>
                </motion.div>

                {/* Arrow */}
                <div className={styles.arrow}>
                  <ChevronRight size={32} strokeWidth={2} color="#9CA3AF" />
                </div>

                {/* Column 2: Solution */}
                <motion.div
                  className={styles.column}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.columnBadge} style={{ background: activeUseCase.iconColor }}>
                      CostQ 解决方案
                    </div>
                  </div>
                  <div className={styles.columnContent}>
                    <ul className={styles.featureList}>
                      {activeUseCase.features.map((feature, idx) => (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + idx * 0.1 }}
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" fill={activeUseCase.iconColor} opacity="0.2" />
                            <path
                              d="M6 10l3 3 5-6"
                              stroke={activeUseCase.iconColor}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>{feature}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.div>

                {/* Arrow */}
                <div className={styles.arrow}>
                  <ChevronRight size={32} strokeWidth={2} color="#9CA3AF" />
                </div>

                {/* Column 3: Result */}
                <motion.div
                  className={styles.column}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.columnBadge} style={{ background: '#10B981' }}>
                      真实效果
                    </div>
                  </div>
                  <div className={styles.columnContent}>
                    <div className={styles.resultBox} style={{ borderColor: activeUseCase.iconColor }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={styles.resultIcon}>
                        <path
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          stroke={activeUseCase.iconColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p>{activeUseCase.result}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Background decorations */}
      <div className={styles.bgDecoration}>
        <div className={styles.gradient1} />
        <div className={styles.gradient2} />
      </div>
    </section>
  );
};
