import React, { useState } from 'react';
import { Bot, User, Send, Paperclip, Plus, Settings, Box, Bell, Copy, Download, Trash2, CheckSquare, X, ChevronDown } from 'lucide-react';
import styles from './DashboardPreview.module.css';

// 多语言内容定义
const translations = {
  zh: {
    brand: 'CostQ 云成本专家',
    newChat: '新建对话',
    alertManage: '告警管理',
    chatHistory: '聊天历史',
    settings: '设置',
    assistant: 'Assistant',
    aiMsg1: '我来帮您查询本月的 AWS 用量情况。首先让我获取当前日期，然后查询本月的成本和用量数据。现在我来查询本月（2026年2月1日至2月10日）的成本和用量数据。',
    title: '🟠 AWS 本月用量分析 - 账号 1024',
    dateRange: '📅 查询时间范围',
    dateRangeValue: '2026年2月1日 - 2026年2月10日（10天数据）',
    overview: '📊 总体概览',
    totalCost: '总成本',
    avgCost: '日均成本',
    activeServices: '活跃服务数',
    dataStatus: '数据状态',
    estimated: '预估值 (Estimated)',
    topServices: '💰 主要服务成本与用量 (Top 15)',
    serviceName: '服务名称',
    totalCostUSD: '总成本 (USD)',
    totalUsage: '总用量',
    costRatio: '成本占比',
    keyDetails: '🔍 关键服务用量详情',
    computeServices: '计算服务',
    ec2Instance: 'EC2 实例',
    hours: '小时',
    cost: '成本',
    eksCluster: 'EKS 集群',
    lambdaCalls: '次调用',
    databaseServices: '数据库服务',
    rdsRuntime: '运行时间',
    costAnalysis: '📈 成本结构分析',
    mainCostSource: '主要成本来源:',
    compute: '计算资源 (EC2 + EKS)',
    database: '数据库服务 (RDS)',
    storage: '存储服务 (S3)',
    network: '网络服务 (VPC + ELB)',
    dataNote: '数据说明:',
    dataNote1: '所有数据为预估值，最终账单可能有所调整',
    dataNote2: '2月10日数据为 $0（当天数据尚未完全生成）',
    tokenUsage: '💾 Token 使用',
    input: '输入',
    output: '输出',
    cacheRead: '缓存读取',
    cacheWrite: '缓存写入',
    placeholder: '输入您的问题... (Enter 发送, Shift+Enter 换行)',
    disclaimer: 'AI 生成内容仅供参考，请核实关键成本信息。',
    historyItems: ['输出本月用量', '你好', '查询本月用量']
  },
  en: {
    brand: 'CostQ Cloud Cost Expert',
    newChat: 'New Chat',
    alertManage: 'Alert Management',
    chatHistory: 'Chat History',
    settings: 'Settings',
    assistant: 'Assistant',
    aiMsg1: 'Let me help you query this month\'s AWS usage. First, I\'ll get the current date, then query this month\'s cost and usage data. Now querying data from February 1 to February 10, 2026.',
    title: '🟠 AWS Monthly Usage Analysis - Account 1024',
    dateRange: '📅 Query Time Range',
    dateRangeValue: 'Feb 1, 2026 - Feb 10, 2026 (10 days data)',
    overview: '📊 Overview',
    totalCost: 'Total Cost',
    avgCost: 'Daily Avg',
    activeServices: 'Active Services',
    dataStatus: 'Data Status',
    estimated: 'Estimated',
    topServices: '💰 Top Services Cost & Usage (Top 15)',
    serviceName: 'Service Name',
    totalCostUSD: 'Total Cost (USD)',
    totalUsage: 'Total Usage',
    costRatio: 'Cost Ratio',
    keyDetails: '🔍 Key Service Usage Details',
    computeServices: 'Compute Services',
    ec2Instance: 'EC2 Instances',
    hours: 'hours',
    cost: 'cost',
    eksCluster: 'EKS Cluster',
    lambdaCalls: 'invocations',
    databaseServices: 'Database Services',
    rdsRuntime: 'runtime',
    costAnalysis: '📈 Cost Structure Analysis',
    mainCostSource: 'Main Cost Sources:',
    compute: 'Compute Resources (EC2 + EKS)',
    database: 'Database Services (RDS)',
    storage: 'Storage Services (S3)',
    network: 'Network Services (VPC + ELB)',
    dataNote: 'Data Notes:',
    dataNote1: 'All data are estimated, final bill may vary',
    dataNote2: 'Feb 10 data is $0 (daily data not yet generated)',
    tokenUsage: '💾 Token Usage',
    input: 'Input',
    output: 'Output',
    cacheRead: 'Cache Read',
    cacheWrite: 'Cache Write',
    placeholder: 'Type your question... (Enter to send, Shift+Enter for new line)',
    disclaimer: 'AI-generated content is for reference only. Please verify critical cost information.',
    historyItems: ['Output monthly usage', 'Hello', 'Query monthly usage']
  },
  ja: {
    brand: 'CostQ クラウドコスト専門家',
    newChat: '新しいチャット',
    alertManage: 'アラート管理',
    chatHistory: 'チャット履歴',
    settings: '設定',
    assistant: 'アシスタント',
    aiMsg1: '今月のAWS使用状況を照会いたします。まず現在の日付を取得し、次に今月のコストと使用状況データを照会します。2026年2月1日から2月10日までのデータを照会しています。',
    title: '🟠 AWS 月次使用状況分析 - アカウント 1024',
    dateRange: '📅 照会期間',
    dateRangeValue: '2026年2月1日 - 2026年2月10日（10日間のデータ）',
    overview: '📊 全体概要',
    totalCost: '総コスト',
    avgCost: '1日平均',
    activeServices: 'アクティブサービス数',
    dataStatus: 'データステータス',
    estimated: '推定値 (Estimated)',
    topServices: '💰 主要サービスコストと使用量 (Top 15)',
    serviceName: 'サービス名',
    totalCostUSD: '総コスト (USD)',
    totalUsage: '総使用量',
    costRatio: 'コスト比率',
    keyDetails: '🔍 主要サービス使用量詳細',
    computeServices: 'コンピューティングサービス',
    ec2Instance: 'EC2 インスタンス',
    hours: '時間',
    cost: 'コスト',
    eksCluster: 'EKS クラスター',
    lambdaCalls: '回の呼び出し',
    databaseServices: 'データベースサービス',
    rdsRuntime: '稼働時間',
    costAnalysis: '📈 コスト構造分析',
    mainCostSource: '主なコスト源:',
    compute: 'コンピューティングリソース (EC2 + EKS)',
    database: 'データベースサービス (RDS)',
    storage: 'ストレージサービス (S3)',
    network: 'ネットワークサービス (VPC + ELB)',
    dataNote: 'データ説明:',
    dataNote1: 'すべてのデータは推定値です。最終的な請求書は異なる場合があります',
    dataNote2: '2月10日のデータは$0です（当日のデータはまだ生成されていません）',
    tokenUsage: '💾 Token 使用状況',
    input: '入力',
    output: '出力',
    cacheRead: 'キャッシュ読み取り',
    cacheWrite: 'キャッシュ書き込み',
    placeholder: '質問を入力してください... (Enter で送信、Shift+Enter で改行)',
    disclaimer: 'AI生成コンテンツは参考用です。重要なコスト情報は必ず確認してください。',
    historyItems: ['月次使用量を出力', 'こんにちは', '月次使用量を照会']
  }
};

export const DashboardPreview: React.FC = () => {
  // 默认中文，可以通过浏览器语言自动检测
  const [lang, setLang] = useState<'zh' | 'en' | 'ja'>(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ja')) return 'ja';
    if (browserLang.startsWith('en')) return 'en';
    return 'zh';
  });

  const t = translations[lang];

  return (
    <div className={styles.previewContainer}>
      <div className={styles.appLayout}>
        {/* Left Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <Box size={16} color="#3B82F6" />
            <span>{t.brand}</span>
            <div style={{ marginLeft: 'auto' }}><div style={{ width: 12, height: 12, border: '1px solid #CBD5E1', borderRadius: 2 }}></div></div>
          </div>
          <div className={styles.newChatBtn}>
            <Plus size={14} /> {t.newChat}
          </div>
          <div className={styles.alertBtn}>
            <Bell size={14} /> {t.alertManage}
          </div>

          <div className={styles.historySection}>
            <div className={styles.historyGroup}>
              <div className={styles.historyLabel}>
                <span>{t.chatHistory} (14)</span>
                <div style={{ display: 'flex', gap: 6, color: '#94A3B8' }}>
                   <CheckSquare size={12} />
                   <Trash2 size={12} />
                </div>
              </div>

              <div className={`${styles.historyItem} ${styles.active}`}>
                <div className={styles.historyTitle}>{t.historyItems[0]}</div>
                <div className={styles.historyDate}>2026-02-10</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>{t.historyItems[1]}</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>{t.historyItems[0]}</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>{t.historyItems[2]}</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
              <div className={styles.historyItem}>
                <div className={styles.historyTitle}>{t.historyItems[0]}</div>
                <div className={styles.historyDate}>2026-02-09</div>
              </div>
            </div>
          </div>

          <div className={styles.sidebarFooter}>
            <Settings size={14} />
            <span>{t.settings}</span>
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
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: '#334155' }}>{t.assistant}</div>

                <p>{t.aiMsg1}</p>

                <div style={{ fontWeight: 700, fontSize: 15, margin: '16px 0 8px', color: '#F59E0B' }}># {t.title}</div>

                <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#64748B', marginBottom: 16, border: '1px solid #F1F5F9' }}>
                  <strong>{t.dateRange}</strong>: {t.dateRangeValue}
                </div>

                <div className={styles.sectionTitle}>{t.overview}</div>
                <ul style={{ paddingLeft: '20px', margin: '8px 0', fontSize: '13px', listStyleType: 'disc', color: '#334155' }}>
                  <li><strong>{t.totalCost}</strong>: $2,450.00</li>
                  <li><strong>{t.avgCost}</strong>: $245.00</li>
                  <li><strong>{t.activeServices}</strong>: 42</li>
                  <li><strong>{t.dataStatus}</strong>: {t.estimated}</li>
                </ul>

                <div className={styles.sectionTitle}>{t.topServices}</div>
                <div className={styles.tableWrapper}>
                  <div className={styles.tableHeader}>
                    <span>{t.serviceName}</span>
                    <span>{t.totalCostUSD}</span>
                    <span>{t.totalUsage}</span>
                    <span>{t.costRatio}</span>
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

                <div className={styles.sectionTitle}>{t.keyDetails}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.computeServices}</div>
                    <ul style={{ paddingLeft: 20, margin: 0, listStyleType: 'disc' }}>
                      <li><strong>{t.ec2Instance}</strong>: 2,400 {t.hours}, {t.cost} $850.00</li>
                      <li><strong>{t.eksCluster}</strong>: 1,200 {t.hours}, {t.cost} $450.00</li>
                      <li><strong>Lambda</strong>: 5,000,000 {t.lambdaCalls}, {t.cost} $55.00</li>
                    </ul>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.databaseServices}</div>
                    <ul style={{ paddingLeft: 20, margin: 0, listStyleType: 'disc' }}>
                      <li><strong>RDS</strong>: 720 {t.hours} {t.rdsRuntime}, {t.cost} $620.00</li>
                      <li><strong>ElastiCache</strong>: 200 {t.hours}, {t.cost} $85.00</li>
                    </ul>
                  </div>
                </div>

                <div className={styles.sectionTitle}>{t.costAnalysis}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                  <p style={{ margin: '0 0 4px 0' }}><strong>{t.mainCostSource}</strong></p>
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    <li>{t.compute}: 53.1%</li>
                    <li>{t.database}: 25.3%</li>
                    <li>{t.storage}: 7.3%</li>
                    <li>{t.network}: 6.8%</li>
                  </ol>
                  <p style={{ margin: '12px 0 4px 0' }}><strong>{t.dataNote}</strong></p>
                  <ul style={{ paddingLeft: 20, margin: 0, listStyleType: 'disc' }}>
                    <li>{t.dataNote1}</li>
                    <li>{t.dataNote2}</li>
                  </ul>
                </div>

                {/* Token Stats */}
                <div className={styles.tokenStats}>
                  <span>{t.tokenUsage}</span>
                  <span>{t.input}: 69,536</span>
                  <span>{t.output}: 2,554</span>
                  <span>{t.cacheRead}: <span className={styles.greenText}>207,300(74.9%)</span></span>
                  <span>{t.cacheWrite}: <span className={styles.orangeText}>51,825</span></span>
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
              <span>{t.placeholder}</span>
            </div>
            <div className={styles.disclaimer}>{t.disclaimer}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
