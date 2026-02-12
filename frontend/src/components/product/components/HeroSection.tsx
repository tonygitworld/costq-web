import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Shield, Zap, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthStore } from '@/stores/authStore';
import { Particles } from './Particles';
import styles from './HeroSection.module.css';

// 品牌渐变色
const brandGradient = 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)';

export const HeroSection: React.FC = () => {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section id="hero" className={styles.hero}>
      {/* 粒子背景层 */}
      <div className={styles.particlesLayer}>
        <Particles
          particleColors={['#3B82F6', '#60A5FA', '#93C5FD']}
          particleCount={80}
          speed={0.05}
          particleSpread={3}
          particleBaseSize={2}
          moveParticlesOnHover={true}
          alphaParticles={true}
          pixelRatio={window.devicePixelRatio || 1}
        />
      </div>

      {/* 背景渐变层 */}
      <div className={styles.gradientBg} />

      {/* 网格背景 */}
      <div className={styles.gridBg} />

      <div className={styles.container} ref={containerRef}>
        {/* 左侧：核心内容 */}
        <motion.div
          className={styles.contentLeft}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* 徽章 */}
          <motion.div
            className={styles.badge}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <Zap size={14} className={styles.badgeIcon} />
            <span>{t('product:hero.badge')}</span>
          </motion.div>

          {/* 主标题 */}
          <motion.h1
            className={styles.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <span className={styles.titleLine}>{t('product:hero.titleLine1')}</span>
            <span className={styles.titleHighlight}>
              <span className={styles.highlightText}>{t('product:hero.titleHighlight')}</span>
              <svg className={styles.highlightUnderline} viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 8.5C50 2.5 150 2.5 198 8.5" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </span>
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            className={styles.subtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            {t('product:hero.subtitle')}
          </motion.p>

          {/* 数据指标 */}
          <motion.div
            className={styles.stats}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <div className={styles.statItem}>
              <div className={styles.statIconWrapper} style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <TrendingDown className={styles.statIcon} style={{ color: '#22C55E' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>35%</span>
                <span className={styles.statLabel}>{t('product:hero.stat1Label')}</span>
              </div>
            </div>

            <div className={styles.statDivider} />

            <div className={styles.statItem}>
              <div className={styles.statIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <Zap className={styles.statIcon} style={{ color: '#3B82F6' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>2min</span>
                <span className={styles.statLabel}>{t('product:hero.stat2Label')}</span>
              </div>
            </div>

            <div className={styles.statDivider} />

            <div className={styles.statItem}>
              <div className={styles.statIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                <Shield className={styles.statIcon} style={{ color: '#A855F7' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>SOC2</span>
                <span className={styles.statLabel}>{t('product:hero.stat3Label')}</span>
              </div>
            </div>
          </motion.div>

          {/* CTA 按钮组 */}
          <motion.div
            className={styles.ctaGroup}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <Link to={isAuthenticated ? '/chat' : '/login'} className={styles.primaryBtn}>
              <span>{t('product:hero.ctaPrimary')}</span>
              <ArrowRight size={18} strokeWidth={2.5} className={styles.btnIcon} />
            </Link>
            <a href="#product-showcase" className={styles.secondaryBtn}>
              <BarChart3 size={18} strokeWidth={2} />
              <span>{t('product:hero.ctaSecondary')}</span>
            </a>
          </motion.div>

          {/* 信任提示 */}
          <motion.div
            className={styles.trust}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <Shield size={14} />
            <span>{t('product:hero.trust')}</span>
          </motion.div>
        </motion.div>

        {/* 右侧：产品预览 */}
        <motion.div
          className={styles.contentRight}
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.productCard}>
            {/* 装饰性光晕 */}
            <div className={styles.glowTop} />
            <div className={styles.glowBottom} />

            {/* 仪表盘预览 */}
            <div className={styles.dashboardPreview}>
              {/* 顶部栏 */}
              <div className={styles.dashboardHeader}>
                <div className={styles.headerDots}>
                  <span className={styles.dot} style={{ background: '#EF4444' }} />
                  <span className={styles.dot} style={{ background: '#F59E0B' }} />
                  <span className={styles.dot} style={{ background: '#22C55E' }} />
                </div>
                <div className={styles.headerTitle}>CostQ Dashboard</div>
                <div className={styles.headerSpacer} />
              </div>

              {/* 内容区域 */}
              <div className={styles.dashboardBody}>
                {/* AI 对话演示 */}
                <motion.div
                  className={styles.chatSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  <div className={styles.userBubble}>
                    <span className={styles.bubbleLabel}>用户</span>
                    <p>分析一下本月 AWS 成本变化</p>
                  </div>

                  <motion.div
                    className={styles.aiBubble}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6 }}
                  >
                    <div className={styles.aiHeader}>
                      <Zap size={14} style={{ color: '#3B82F6' }} />
                      <span>CostQ AI</span>
                    </div>
                    <div className={styles.aiContent}>
                      <p>本月总支出 <strong>$12,450</strong>，环比下降 <strong style={{ color: '#22C55E' }}>8.3%</strong></p>

                      {/* 优化建议卡片 */}
                      <div className={styles.insightCard}>
                        <div className={styles.insightHeader}>
                          <TrendingDown size={16} style={{ color: '#22C55E' }} />
                          <span>节省来源</span>
                        </div>
                        <div className={styles.insightList}>
                          <div className={styles.insightItem}>
                            <span>EC2 RI 覆盖率提升</span>
                            <span className={styles.insightValue} style={{ color: '#22C55E' }}>-$1,200</span>
                          </div>
                          <div className={styles.insightItem}>
                            <span>清理闲置 RDS</span>
                            <span className={styles.insightValue} style={{ color: '#22C55E' }}>-$450</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* 底部图表预览 */}
                <div className={styles.chartPreview}>
                  <div className={styles.chartHeader}>
                    <span className={styles.chartTitle}>成本趋势</span>
                    <span className={styles.chartPeriod}>近 6 个月</span>
                  </div>
                  <div className={styles.chartBars}>
                    {[60, 75, 45, 80, 55, 40].map((height, i) => (
                      <motion.div
                        key={i}
                        className={styles.chartBar}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: 1.8 + i * 0.1, duration: 0.6 }}
                        style={{ background: height > 70 ? '#22C55E' : '#3B82F6' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 浮动卡片 */}
            <motion.div
              className={styles.floatingCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 0.8 }}
            >
              <div className={styles.cardIcon} style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <TrendingDown size={16} style={{ color: '#22C55E' }} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardTitle}>成本优化</span>
                <span className={styles.cardValue}>+3 条建议</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* 底部渐变遮罩 */}
      <div className={styles.bottomFade} />
    </section>
  );
};
