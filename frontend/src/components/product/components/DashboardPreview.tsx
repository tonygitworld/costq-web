import React from 'react';
import { Bot, User, Send, Paperclip, Plus, Settings, Box, Bell, Copy, Download, Trash2, CheckSquare, X, ChevronDown } from 'lucide-react';
import styles from './DashboardPreview.module.css';

export const DashboardPreview: React.FC = () => {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.appLayout}>
        {/* Left Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <Box size={16} color="#3B82F6" />
            <span>CostQ 云成本专家</span>
            <div style={{ marginLeft: 'auto' }}><div style={{ width: 12, height: 12, border: '1px solid #CBD5E1', borderRadius: 2 }}></div></div>
          </div>
          <div className={styles.newChatBtn}>
            <Plus size={14} /> 新建对话
          </div>
          <div className={styles.alertBtn}>
            <Bell size={14} /> 告警管理
          </div>

          <div className={styles.historySection}>
            <div className={styles.historyGroup}>
              <div className={styles.historyLabel}>
                <span>聊天历史 (14)</span>
                <div style={{ display: 'flex', gap: 6, color: '#94A3B8' }}>
                   <CheckSquare size={12} />
                   <Trash2 size={12} />
                </div>
              </div>

              <div className={`${styles.historyItem} ${styles.active}`}>
                <div className={styles.historyTitle}>输出本月用量</div>
                <div className={styles.historyDate}>2026-02-10</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>你好</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>输出本月用量</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>查询本月用量</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>输出本月用量</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
            </div>
          </div>

          <div className={styles.sidebarFooter}>
            <Settings size={14} />
            <span>设置</span>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={styles.chatMain}>
          <div className={styles.messageList}>
            {/* AI Message (Full Content) */}
            <div className={styles.messageRow}>
              <div className={`${styles.avatar} ${styles.aiAvatar}`}>
                <Bot size={16} />
              </div>
              <div className={styles.aiContent}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: '#334155' }}>Assistant</div>

                <p>我来帮您查询本月的 AWS 用量情况。首先让我获取当前日期，然后查询本月的成本和用量数据。现在我来查询本月（2026年2月1日至2月10日）的成本和用量数据。</p>

                <div style={{ fontWeight: 700, fontSize: 15, margin: '16px 0 8px', color: '#F59E0B' }}># 🟠 AWS 本月用量分析 - 账号 1024</div>

                <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#64748B', marginBottom: 16, border: '1px solid #F1F5F9' }}>
                  <strong>📅 查询时间范围</strong>: 2026年2月1日 - 2026年2月10日（10天数据）
                </div>

                <div className={styles.sectionTitle}>📊 总体概览</div>
                <ul style={{ paddingLeft: '20px', margin: '8px 0', fontSize: '13px', listStyleType: 'disc', color: '#334155' }}>
                  <li><strong>总成本</strong>: $2,450.00</li>
                  <li><strong>日均成本</strong>: $245.00</li>
                  <li><strong>活跃服务数</strong>: 42</li>
                  <li><strong>数据状态</strong>: 预估值 (Estimated)</li>
                </ul>

                <div className={styles.sectionTitle}>💰 主要服务成本与用量 (Top 15)</div>
                <div className={styles.tableWrapper}>
                  <div className={styles.tableHeader}>
                    <span>服务名称</span>
                    <span>总成本 (USD)</span>
                    <span>总用量</span>
                    <span>成本占比</span>
                  </div>
                  {[
                    { name: 'Amazon EC2 - Compute', cost: '$850.00', usage: '2,400 Hrs', pct: '34.7%' },
                    { name: 'Amazon RDS', cost: '$620.00', usage: '720 Hrs', pct: '25.3%' },
                    { name: 'Amazon EKS', cost: '$450.00', usage: '1,200 Hrs', pct: '18.4%' },
                    { name: 'Amazon S3', cost: '$180.00', usage: '50 TB', pct: '7.3%' },
                    { name: 'Amazon VPC', cost: '$120.00', usage: '15 TB', pct: '4.9%' },
                    { name: 'Amazon CloudWatch', cost: '$90.00', usage: '500M', pct: '3.7%' },
                    { name: 'Amazon ElastiCache', cost: '$85.00', usage: '200 Hrs', pct: '3.5%' },
                    { name: 'Amazon Lambda', cost: '$55.00', usage: '5M Req', pct: '2.2%' },
                  ].map((row, i) => (
                    <div key={i} className={styles.tableRow}>
                      <span className={styles.serviceName}>{row.name}</span>
                      <span className={styles.costVal}>{row.cost}</span>
                      <span>{row.usage}</span>
                      <span>{row.pct}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.sectionTitle}>🔍 关键服务用量详情</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>计算服务</div>
                    <ul style={{ paddingLeft: 20, margin: 0, listStyleType: 'disc' }}>
                      <li><strong>EC2 实例</strong>: 2,400 小时，成本 $850.00</li>
                      <li><strong>EKS 集群</strong>: 1,200 小时，成本 $450.00</li>
                      <li><strong>Lambda</strong>: 5,000,000 次调用，成本 $55.00</li>
                    </ul>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>数据库服务</div>
                    <ul style={{ paddingLeft: 20, margin: 0, listStyleType: 'disc' }}>
                      <li><strong>RDS</strong>: 720 小时运行时间，成本 $620.00</li>
                      <li><strong>ElastiCache</strong>: 200 小时，成本 $85.00</li>
                    </ul>
                  </div>
                </div>

                <div className={styles.sectionTitle}>📈 成本结构分析</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                  <p style={{ margin: '0 0 4px 0' }}><strong>主要成本来源:</strong></p>
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    <li>计算资源 (EC2 + EKS): 53.1%</li>
                    <li>数据库服务 (RDS): 25.3%</li>
                    <li>存储服务 (S3): 7.3%</li>
                    <li>网络服务 (VPC + ELB): 6.8%</li>
                  </ol>
                  <p style={{ margin: '12px 0 4px 0' }}><strong>数据说明:</strong></p>
                  <ul style={{ paddingLeft: 20, margin: 0, listStyleType: 'disc' }}>
                    <li>所有数据为预估值，最终账单可能有所调整</li>
                    <li>2月10日数据为 $0（当天数据尚未完全生成）</li>
                  </ul>
                </div>

                {/* Token Stats */}
                <div className={styles.tokenStats}>
                  <span>💾 Token 使用</span>
                  <span>输入: 69,536</span>
                  <span>输出: 2,554</span>
                  <span>缓存读取: <span className={styles.greenText}>207,300(74.9%)</span></span>
                  <span>缓存写入: <span className={styles.orangeText}>51,825</span></span>
                </div>

                {/* Footer */}
                <div className={styles.msgFooter}>
                  <span>10:24</span>
                  <Copy size={12} className={styles.iconBtn} />
                  <Download size={12} className={styles.iconBtn} />
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className={styles.inputContainer}>
            <div className={styles.inputBox}>
              <Paperclip size={18} color="#94A3B8" />
              <span>输入您的问题... (Enter 发送, Shift+Enter 换行)</span>
            </div>
            <div className={styles.disclaimer}>AI 生成内容仅供参考，请核实关键成本信息。</div>
          </div>
        </div>
      </div>
    </div>
  );
};
