import React, { useMemo } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import './WelcomeScreen.css';

// 问候语
const zhGreetings = [
  "今天有什么可以帮您？",
  "需要分析哪个云账号的成本？",
  "想了解一下最近的成本趋势吗？",
  "有什么成本优化的问题吗？"
];
const enGreetings = [
  "How can I help you today?",
  "Which cloud account would you like to analyze?",
  "Want to understand recent cost trends?",
  "Any cost optimization questions?"
];
const jaGreetings = [
  "今日は何をお手伝いできますか？",
  "どのクラウドアカウントのコストを分析しますか？",
  "最近のコスト動向を確認しますか？",
  "コスト最適化についてご質問はありますか？"
];

// 快捷问题（移动端用）
const zhQuickQuestions = [
  "本月各账号花了多少钱？",
  "哪个服务成本最高？",
  "最近30天成本趋势如何？",
  "有哪些可以优化的地方？",
];
const enQuickQuestions = [
  "How much did each account spend this month?",
  "Which service has the highest cost?",
  "What's the cost trend in the last 30 days?",
  "What can be optimized?",
];
const jaQuickQuestions = [
  "今月の各アカウントの費用は？",
  "最もコストが高いサービスは？",
  "過去30日のコスト傾向は？",
  "最適化できる点はありますか？",
];

interface WelcomeScreenProps {
  onQuickQuestion?: (question: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onQuickQuestion }) => {
  const { isZhCN, isJaJP } = useI18n();
  const isMobile = useIsMobile();

  const greeting = useMemo(() => {
    let greetings: string[];
    if (isJaJP()) greetings = jaGreetings;
    else if (isZhCN()) greetings = zhGreetings;
    else greetings = enGreetings;
    return greetings[Math.floor(Math.random() * greetings.length)];
  }, [isZhCN, isJaJP]);

  const quickQuestions = useMemo(() => {
    if (isJaJP()) return jaQuickQuestions;
    if (isZhCN()) return zhQuickQuestions;
    return enQuickQuestions;
  }, [isZhCN, isJaJP]);

  const subtitle = isJaJP()
    ? 'クラウドコストを分析・最適化します'
    : isZhCN()
    ? '帮您分析和优化云服务成本'
    : 'Analyze and optimize your cloud costs';

  if (isMobile) {
    return (
      <div className="welcome-mobile-content">
        {/* 问候语区域 */}
        <div className="welcome-mobile-greeting">
          <h1 className="welcome-mobile-title">{greeting}</h1>
          <p className="welcome-mobile-subtitle">{subtitle}</p>
        </div>

        {/* 快捷问题卡片 */}
        <div className="welcome-mobile-questions">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              className="welcome-quick-question"
              onClick={() => onQuickQuestion?.(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 桌面端：保持原有结构
  return (
    <div className="welcome-screen-container">
      <div className="welcome-header-row">
        <h1 className="welcome-title-serif">{greeting}</h1>
      </div>
    </div>
  );
};
