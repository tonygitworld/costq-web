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
                      <p style={{ fontSize: '13px', lineHeight: 1.6 }}>
                        我来帮您分析本月AWS成本变化。首先获取当前日期，然后查询本月的成本数据。
                        现在查询本月（2026年2月）的成本数据，按日粒度和服务维度进行分析：
                      </p>

                      <div style={{ fontWeight: 700, fontSize: 14, margin: '12px 0 8px', color: '#F59E0B' }}>
                        🟠 AWS 成本分析 - 账号 2048
                      </div>

                      {/* 本月成本概况 */}
                      <div style={{
                        background: '#FEF3C7',
                        padding: '10px 12px',
                        borderRadius: 6,
                        marginBottom: 12,
                        border: '1px solid #FCD34D',
                        fontSize: '12px'
                      }}>
                        <div style={{ fontWeight: 600, color: '#92400E', marginBottom: 6 }}>📊 本月成本概况（2月1日-2月14日）</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#78350F' }}>
                          <div><strong>本月累计成本</strong>: <span style={{ color: '#DC2626', fontWeight: 700 }}>$12,450.00</span></div>
                          <div><strong>日均成本</strong>: $889.29</div>
                          <div><strong>上月总成本</strong>: $13,580.50</div>
                          <div><strong>月度趋势</strong>: <span style={{ color: '#22C55E' }}>↓ 预计低于上月 8.3%</span></div>
                        </div>
                      </div>

                      {/* 每日成本趋势 */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: '#374151', marginBottom: 6 }}>📈 每日成本趋势</div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '55px 55px 50px 35px',
                          gap: '4px',
                          fontSize: '11px',
                          background: '#F9FAFB',
                          padding: '6px 8px',
                          borderRadius: 4
                        }}>
                          <div style={{ fontWeight: 600, color: '#6B7280' }}>日期</div>
                          <div style={{ fontWeight: 600, color: '#6B7280' }}>成本</div>
                          <div style={{ fontWeight: 600, color: '#6B7280' }}>环比</div>
                          <div style={{ fontWeight: 600, color: '#6B7280' }}>趋势</div>

                          {[
                            { date: '2月1日', cost: '$945.20', change: '-', trend: '→', color: '#6B7280' },
                            { date: '2月5日', cost: '$1,120.50', change: '+18.5%', trend: '↑', color: '#EF4444' },
                            { date: '2月8日', cost: '$680.30', change: '-39.3%', trend: '↓', color: '#10B981' },
                            { date: '2月12日', cost: '$1,580.00', change: '+132.2%', trend: '⚠️', color: '#DC2626' },
                          ].map((row, i) => (
                            <React.Fragment key={i}>
                              <div style={{ color: '#374151' }}>{row.date}</div>
                              <div style={{ color: row.trend === '⚠️' ? '#DC2626' : '#374151', fontWeight: row.trend === '⚠️' ? 600 : 400 }}>{row.cost}</div>
                              <div style={{ color: row.color, fontSize: '10px' }}>{row.change}</div>
                              <div style={{ color: row.color }}>{row.trend}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* 主要服务成本 */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: '#374151', marginBottom: 6 }}>🎯 主要服务成本（本月累计）</div>
                        <div style={{ fontSize: '11px', lineHeight: 1.5 }}>
                          {[
                            { name: 'Amazon EC2', cost: '$4,850.00', ratio: '39.0%', isMain: true },
                            { name: 'Amazon RDS', cost: '$2,680.50', ratio: '21.5%', isMain: false },
                            { name: 'Amazon EKS', cost: '$1,920.00', ratio: '15.4%', isMain: false },
                            { name: '其他服务', cost: '$2,999.50', ratio: '24.1%', isMain: false },
                          ].map((svc, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '3px 0',
                              borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none'
                            }}>
                              <span style={{ color: svc.isMain ? '#DC2626' : '#374151', fontWeight: svc.isMain ? 600 : 400 }}>
                                {svc.isMain ? '🔥 ' : ''}{svc.name}
                              </span>
                              <span style={{ color: svc.isMain ? '#DC2626' : '#6B7280', fontWeight: svc.isMain ? 600 : 400 }}>
                                {svc.cost} ({svc.ratio})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 关键发现 */}
                      <div style={{
                        background: '#F0FDF4',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #BBF7D0',
                        fontSize: '11px'
                      }}>
                        <div style={{ fontWeight: 600, color: '#16A34A', marginBottom: 4 }}>🔍 成本优化建议</div>
                        <ul style={{ margin: 0, paddingLeft: 14, color: '#166534', lineHeight: 1.5 }}>
                          <li>EC2 RI 覆盖率提升至 75%，可节省约 $1,200/月</li>
                          <li>发现 3 个闲置 RDS 实例，建议清理可节省 $450/月</li>
                          <li>本月成本控制在预算范围内，较上月优化明显</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

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
