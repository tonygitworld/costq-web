/**
 * 模板标题翻译映射表
 *
 * 用于将后端返回的中文模板标题翻译为多语言
 * 后续添加新模板时，在此文件中添加对应翻译即可
 */

export interface TemplateTranslation {
  'zh-CN': string;
  'en-US': string;
  'ja-JP': string;
}

// 模板标题翻译映射
export const templateTitleTranslations: Record<string, TemplateTranslation> = {
  // AWS 成本分析模板
  "AWS 成本洞察": {
    "zh-CN": "AWS 成本洞察",
    "en-US": "AWS Cost Insights",
    "ja-JP": "AWS コスト分析"
  },

  "RI/SP 数据洞察": {
    "zh-CN": "RI/SP 数据洞察",
    "en-US": "RI/SP Data Insights",
    "ja-JP": "RI/SP データ分析"
  },

  "多账户成本对比": {
    "zh-CN": "多账户成本对比",
    "en-US": "Multi-Account Cost Comparison",
    "ja-JP": "マルチアカウントコスト比較"
  },

  "成本归因分析": {
    "zh-CN": "成本归因分析",
    "en-US": "Cost Attribution Analysis",
    "ja-JP": "コスト帰属分析"
  },

  "RI/SP 利用率分析": {
    "zh-CN": "RI/SP 利用率分析",
    "en-US": "RI/SP Utilization Analysis",
    "ja-JP": "RI/SP 利用率分析"
  },

  "成本异常波动检测": {
    "zh-CN": "成本异常波动检测",
    "en-US": "Cost Anomaly Detection",
    "ja-JP": "コスト異常検出"
  },

  "Savings Plans 购买建议": {
    "zh-CN": "Savings Plans 购买建议",
    "en-US": "Savings Plans Purchase Recommendations",
    "ja-JP": "Savings Plans 購入推奨"
  },

  "检测未使用的资源": {
    "zh-CN": "检测未使用的资源",
    "en-US": "Detect Unused Resources",
    "ja-JP": "未使用リソースの検出"
  },

  "EC2 实例优化建议": {
    "zh-CN": "EC2 实例优化建议",
    "en-US": "EC2 Instance Optimization",
    "ja-JP": "EC2 インスタンス最適化"
  },

  "查看本月成本趋势": {
    "zh-CN": "查看本月成本趋势",
    "en-US": "Monthly Cost Trends",
    "ja-JP": "今月のコストトレンド"
  },

  // GCP 成本分析模板
  "GCP 成本洞察": {
    "zh-CN": "GCP 成本洞察",
    "en-US": "GCP Cost Insights",
    "ja-JP": "GCP コスト分析"
  },

  "GCP CUD 利用率": {
    "zh-CN": "GCP CUD 利用率",
    "en-US": "GCP CUD Utilization",
    "ja-JP": "GCP CUD 利用率"
  },

  "GCP 项目成本对比": {
    "zh-CN": "GCP 项目成本对比",
    "en-US": "GCP Project Cost Comparison",
    "ja-JP": "GCP プロジェクトコスト比較"
  }
};

// 模板描述翻译映射（可选）
export const templateDescTranslations: Record<string, TemplateTranslation> = {
  // 图片中实际显示的4个tooltip
  "AWS 云成本治理与优化分析": {
    "zh-CN": "AWS 云成本治理与优化分析",
    "en-US": "AWS cloud cost governance and optimization analysis",
    "ja-JP": "AWSクラウドコストガバナンスと最適化分析"
  },

  "Savings Plans、RDS RI 和 ElastiCache RI 利用率、覆盖率、购买推荐数据分析": {
    "zh-CN": "Savings Plans、RDS RI 和 ElastiCache RI 利用率、覆盖率、购买推荐数据分析",
    "en-US": "Savings Plans, RDS RI and ElastiCache RI utilization, coverage, and purchase recommendation data analysis",
    "ja-JP": "Savings Plans、RDS RI、ElastiCache RIの利用率、カバレッジ、購入推奨データ分析"
  },

  "对比多个 AWS 账户的成本情况，识别成本差异和优化机会": {
    "zh-CN": "对比多个 AWS 账户的成本情况，识别成本差异和优化机会",
    "en-US": "Compare costs across multiple AWS accounts, identify cost differences and optimization opportunities",
    "ja-JP": "複数のAWSアカウントのコスト状況を比較し、コスト差異と最適化機会を特定"
  },

  "按项目、团队或业务线进行成本归因，识别成本占比最高的部门": {
    "zh-CN": "按项目、团队或业务线进行成本归因，识别成本占比最高的部门",
    "en-US": "Attribute costs by project, team or business line, identify departments with highest cost share",
    "ja-JP": "プロジェクト、チーム、または事業ラインごとにコストを帰属し、最もコスト比率の高い部門を特定"
  },

  // 第5个：RI/SP 利用率分析
  "深度分析预留实例和 Savings Plans 的利用率，优化承诺购买策略": {
    "zh-CN": "深度分析预留实例和 Savings Plans 的利用率，优化承诺购买策略",
    "en-US": "In-depth analysis of Reserved Instance and Savings Plans utilization, optimize commitment purchase strategy",
    "ja-JP": "リザーブドインスタンスとSavings Plansの利用率を詳細分析し、コミットメント購入戦略を最適化"
  },

  // 第6个：成本异常波动检测
  "检测最近 7 天的成本异常波动，识别突增的服务和资源": {
    "zh-CN": "检测最近 7 天的成本异常波动，识别突增的服务和资源",
    "en-US": "Detect cost anomalies in the last 7 days, identify services and resources with sudden increases",
    "ja-JP": "過去7日間のコスト異常を検出し、急増したサービスとリソースを特定"
  },

  // 第7个：Savings Plans 购买建议
  "识别可转换为 Savings Plans 的 EC2 和 Lambda 资源，计算潜在节省金额": {
    "zh-CN": "识别可转换为 Savings Plans 的 EC2 和 Lambda 资源，计算潜在节省金额",
    "en-US": "Identify EC2 and Lambda resources convertible to Savings Plans, calculate potential savings",
    "ja-JP": "Savings Plansに変換可能なEC2とLambdaリソースを特定し、潜在的な節約額を計算"
  },

  // 第8个：检测未使用的资源
  "识别未使用的 EBS 卷、弹性 IP、负载均衡器等资源，估算可节省的成本": {
    "zh-CN": "识别未使用的 EBS 卷、弹性 IP、负载均衡器等资源，估算可节省的成本",
    "en-US": "Identify unused EBS volumes, Elastic IPs, load balancers and other resources, estimate cost savings",
    "ja-JP": "未使用のEBSボリューム、Elastic IP、ロードバランサーなどのリソースを特定し、削減可能なコストを推定"
  },

  // 第9个：EC2 实例优化建议
  "分析 EC2 实例的优化建议，包括实例类型调整（Rightsizing）和预留实例推荐": {
    "zh-CN": "分析 EC2 实例的优化建议，包括实例类型调整（Rightsizing）和预留实例推荐",
    "en-US": "Analyze EC2 instance optimization recommendations, including instance type rightsizing and reserved instance suggestions",
    "ja-JP": "EC2インスタンスの最適化推奨を分析、インスタンスタイプの適正化とリザーブドインスタンスの推奨を含む"
  },

  // 第10个：查看本月成本趋势
  "显示当前月份的 AWS 成本趋势图表，包括每日支出明细和环比变化": {
    "zh-CN": "显示当前月份的 AWS 成本趋势图表，包括每日支出明细和环比变化",
    "en-US": "Display AWS cost trend charts for current month, including daily spending details and month-over-month changes",
    "ja-JP": "当月のAWSコストトレンドグラフを表示、日次支出明細と前月比変化を含む"
  },

  "查看AWS账号的整体成本概况": {
    "zh-CN": "查看AWS账号的整体成本概况",
    "en-US": "View overall AWS account cost overview",
    "ja-JP": "AWSアカウントの全体的なコスト概要を表示"
  },

  "分析Reserved Instance和Savings Plans的使用情况": {
    "zh-CN": "分析Reserved Instance和Savings Plans的使用情况",
    "en-US": "Analyze Reserved Instance and Savings Plans usage",
    "ja-JP": "Reserved InstanceとSavings Plansの使用状況を分析"
  },

  "对比多个AWS账号的成本数据": {
    "zh-CN": "对比多个AWS账号的成本数据",
    "en-US": "Compare cost data across multiple AWS accounts",
    "ja-JP": "複数のAWSアカウントのコストデータを比較"
  },

  "分析成本增长的具体原因": {
    "zh-CN": "分析成本增长的具体原因",
    "en-US": "Analyze specific reasons for cost increases",
    "ja-JP": "コスト増加の具体的な理由を分析"
  },

  "检查RI/SP的利用率和覆盖率": {
    "zh-CN": "检查RI/SP的利用率和覆盖率",
    "en-US": "Check RI/SP utilization and coverage rates",
    "ja-JP": "RI/SPの利用率とカバレッジ率を確認"
  },

  "识别成本异常波动并提供分析": {
    "zh-CN": "识别成本异常波动并提供分析",
    "en-US": "Identify cost anomalies and provide analysis",
    "ja-JP": "コスト異常を特定して分析を提供"
  },

  "获取Savings Plans的智能购买建议": {
    "zh-CN": "获取Savings Plans的智能购买建议",
    "en-US": "Get intelligent Savings Plans purchase recommendations",
    "ja-JP": "Savings Plansのスマート購入推奨を取得"
  },

  "发现未使用或利用率低的资源": {
    "zh-CN": "发现未使用或利用率低的资源",
    "en-US": "Discover unused or underutilized resources",
    "ja-JP": "未使用または低利用率のリソースを発見"
  },

  "获取EC2实例类型优化建议": {
    "zh-CN": "获取EC2实例类型优化建议",
    "en-US": "Get EC2 instance type optimization recommendations",
    "ja-JP": "EC2インスタンスタイプの最適化推奨を取得"
  },

  "查看本月AWS成本变化趋势": {
    "zh-CN": "查看本月AWS成本变化趋势",
    "en-US": "View monthly AWS cost trend analysis",
    "ja-JP": "今月のAWSコスト変化トレンドを表示"
  }
};

/**
 * 语言代码规范化
 */
const normalizeLanguage = (lng: string): string => {
  const normalized = lng.toLowerCase().replace('_', '-');
  const mapping: Record<string, string> = {
    'zh': 'zh-CN',
    'zh-cn': 'zh-CN',
    'en': 'en-US',
    'en-us': 'en-US',
    'ja': 'ja-JP',
    'ja-jp': 'ja-JP'
  };
  return mapping[normalized] || normalized;
};

/**
 * 翻译模板标题
 * @param title - 原始标题（中文）
 * @param language - 目标语言
 * @returns 翻译后的标题，如果没有翻译则返回原标题
 */
export const translateTemplateTitle = (title: string, language: string): string => {
  const translation = templateTitleTranslations[title];
  if (!translation) {
    return title;
  }

  const normalizedLng = normalizeLanguage(language);
  return translation[normalizedLng as keyof TemplateTranslation] || title;
};

/**
 * 翻译模板描述
 * @param description - 原始描述（中文）
 * @param language - 目标语言
 * @returns 翻译后的描述，如果没有翻译则返回原描述
 */
export const translateTemplateDescription = (description: string | undefined, language: string): string | undefined => {
  if (!description) return description;

  const translation = templateDescTranslations[description];
  if (!translation) {
    return description;
  }

  const normalizedLng = normalizeLanguage(language);
  return translation[normalizedLng as keyof TemplateTranslation];
};
