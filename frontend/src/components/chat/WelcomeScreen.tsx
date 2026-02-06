import React, { useMemo } from 'react';
import { useI18n } from '../../hooks/useI18n';
import './WelcomeScreen.css';

// 中文欢迎语列表
const zhGreetings = [
  "今天有什么可以帮您？",
  "需要分析哪个云账号的成本？",
  "想了解一下最近的成本趋势吗？",
  "有什么成本优化的问题吗？"
];

// 英文欢迎语列表
const enGreetings = [
  "How can I help you today?",
  "Which cloud account would you like to analyze?",
  "Want to understand recent cost trends?",
  "Any cost optimization questions?"
];

// 日文欢迎语列表
const jaGreetings = [
  "今日は何をお手伝いできますか？",
  "どのクラウドアカウントのコストを分析しますか？",
  "最近のコスト動向を確認しますか？",
  "コスト最適化についてご質問はありますか？"
];

export const WelcomeScreen: React.FC = () => {
  const { isZhCN, isJaJP } = useI18n();

  // 随机选择问候语
  const greeting = useMemo(() => {
    // 根据当前语言选择对应的欢迎语列表
    let greetings: string[];
    if (isJaJP()) {
      greetings = jaGreetings;
    } else if (isZhCN()) {
      greetings = zhGreetings;
    } else {
      greetings = enGreetings;
    }
    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
  }, [isZhCN, isJaJP]);

  return (
    <div className="welcome-screen-container">
      {/* 图标与文字 */}
      <div className="welcome-header-row">
        <h1 className="welcome-title-serif">{greeting}</h1>
      </div>
    </div>
  );
};
