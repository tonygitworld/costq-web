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
  }
};

// 模板描述翻译映射（可选）
export const templateDescTranslations: Record<string, TemplateTranslation> = {
  "AWS 云成本治理与优化分析": {
    "zh-CN": "AWS 云成本治理与优化分析",
    "en-US": "AWS cloud cost governance and optimization analysis",
    "ja-JP": "AWSクラウドコストガバナンスと最適化分析"
  },

  "Savings Plans、RDS RI 和 ElastiCache RI 利用率、覆盖率、购买推荐数据分析": {
    "zh-CN": "Savings Plans、RDS RI 和 ElastiCache RI 利用率、覆盖率、购买推荐数据分析",
    "en-US": "Savings Plans, RDS RI and ElastiCache RI utilization, coverage, and purchase recommendation data analysis",
    "ja-JP": "Savings Plans、RDS RI、ElastiCache RIの利用率、カバレッジ、購入推奨データ分析"
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
