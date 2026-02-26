#!/usr/bin/env node

/**
 * i18n 翻译键完整性检查脚本
 *
 * 功能：
 * 1. 对比 zh-CN、en-US、ja-JP 三个目录下所有 JSON 文件的键结构
 * 2. 检查是否有缺失或多余的键
 * 3. 验证变量占位符（{{variable}}）在三种语言中是否一致
 * 4. 输出详细的检查报告
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales');
const LOCALES = ['zh-CN', 'en-US', 'ja-JP'];
const NAMESPACES = [
  'common',
  'auth',
  'chat',
  'account',
  'user',
  'template',
  'alert',
  'error',
  'ops',
  'gcp',
  'models'
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * 递归展平嵌套对象的键
 * @param {Object} obj - 要展平的对象
 * @param {string} prefix - 键前缀
 * @returns {Array<string>} 展平后的键数组
 */
function flattenKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      return acc.concat(flattenKeys(obj[key], newKey));
    }
    return acc.concat(newKey);
  }, []);
}

/**
 * 提取字符串中的变量占位符
 * @param {string} str - 翻译字符串
 * @returns {Array<string>} 变量名数组
 */
function extractVariables(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, '')).sort();
}

/**
 * 递归获取对象中指定键的值
 * @param {Object} obj - 对象
 * @param {string} keyPath - 键路径（如 'user.profile.name'）
 * @returns {*} 键对应的值
 */
function getValueByPath(obj, keyPath) {
  return keyPath.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * 检查单个命名空间的翻译键完整性
 * @param {string} namespace - 命名空间名称
 * @returns {Object} 检查结果
 */
function checkNamespace(namespace) {
  const result = {
    namespace,
    missingKeys: {},
    extraKeys: {},
    variableMismatches: [],
    totalKeys: 0,
    success: true
  };

  // 读取所有语言的翻译文件
  const translations = {};
  const keys = {};

  for (const locale of LOCALES) {
    const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(colorize(`✗ 文件不存在: ${filePath}`, 'red'));
      result.success = false;
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      translations[locale] = JSON.parse(content);
      keys[locale] = flattenKeys(translations[locale]);
    } catch (error) {
      console.error(colorize(`✗ 解析失败: ${filePath}`, 'red'));
      console.error(colorize(`  错误: ${error.message}`, 'red'));
      result.success = false;
      continue;
    }
  }

  // 如果没有成功加载所有语言，返回失败
  if (Object.keys(keys).length !== LOCALES.length) {
    return result;
  }

  // 获取所有唯一的键
  const allKeys = [...new Set([...keys['zh-CN'], ...keys['en-US'], ...keys['ja-JP']])];
  result.totalKeys = allKeys.length;

  // 检查每种语言是否缺失键
  for (const locale of LOCALES) {
    const missing = allKeys.filter(key => !keys[locale].includes(key));
    if (missing.length > 0) {
      result.missingKeys[locale] = missing;
      result.success = false;
    }

    // 检查是否有多余的键（存在于当前语言但不在其他语言中）
    const extra = keys[locale].filter(key => !allKeys.includes(key));
    if (extra.length > 0) {
      result.extraKeys[locale] = extra;
    }
  }

  // 检查变量占位符一致性
  for (const key of allKeys) {
    const variables = {};
    let hasValue = false;

    for (const locale of LOCALES) {
      const value = getValueByPath(translations[locale], key);
      if (value !== undefined) {
        hasValue = true;
        variables[locale] = extractVariables(value);
      }
    }

    if (!hasValue) continue;

    // 比较变量是否一致
    const localesWithValue = Object.keys(variables);
    if (localesWithValue.length < 2) continue;

    const firstLocale = localesWithValue[0];
    const firstVars = variables[firstLocale];

    for (let i = 1; i < localesWithValue.length; i++) {
      const locale = localesWithValue[i];
      const currentVars = variables[locale];

      if (JSON.stringify(firstVars) !== JSON.stringify(currentVars)) {
        result.variableMismatches.push({
          key,
          variables
        });
        result.success = false;
        break;
      }
    }
  }

  return result;
}

/**
 * 主函数
 */
function main() {
  console.log(colorize('\n========================================', 'cyan'));
  console.log(colorize('   i18n 翻译键完整性检查', 'cyan'));
  console.log(colorize('========================================\n', 'cyan'));

  let totalSuccess = true;
  const summary = {
    totalNamespaces: NAMESPACES.length,
    successCount: 0,
    failureCount: 0,
    totalKeys: 0,
    totalMissingKeys: 0,
    totalVariableMismatches: 0
  };

  // 检查每个命名空间
  for (const namespace of NAMESPACES) {
    const result = checkNamespace(namespace);
    summary.totalKeys += result.totalKeys;

    if (result.success) {
      console.log(colorize(`✓ ${namespace}`, 'green') + colorize(` (${result.totalKeys} 个键)`, 'blue'));
      summary.successCount++;
    } else {
      console.log(colorize(`✗ ${namespace}`, 'red') + colorize(` (${result.totalKeys} 个键)`, 'blue'));
      summary.failureCount++;
      totalSuccess = false;

      // 输出缺失的键
      for (const locale of LOCALES) {
        if (result.missingKeys[locale]?.length > 0) {
          console.log(colorize(`  缺失键 [${locale}]:`, 'yellow'));
          result.missingKeys[locale].forEach(key => {
            console.log(colorize(`    - ${key}`, 'yellow'));
            summary.totalMissingKeys++;
          });
        }
      }

      // 输出多余的键
      for (const locale of LOCALES) {
        if (result.extraKeys[locale]?.length > 0) {
          console.log(colorize(`  多余键 [${locale}]:`, 'magenta'));
          result.extraKeys[locale].forEach(key => {
            console.log(colorize(`    - ${key}`, 'magenta'));
          });
        }
      }

      // 输出变量不匹配
      if (result.variableMismatches.length > 0) {
        console.log(colorize(`  变量占位符不一致:`, 'red'));
        result.variableMismatches.forEach(({ key, variables }) => {
          console.log(colorize(`    ${key}:`, 'red'));
          for (const locale of Object.keys(variables)) {
            const vars = variables[locale].length > 0
              ? variables[locale].join(', ')
              : '(无变量)';
            console.log(colorize(`      ${locale}: {{${vars}}}`, 'yellow'));
          }
          summary.totalVariableMismatches++;
        });
      }

      console.log('');
    }
  }

  // 输出总结
  console.log(colorize('\n========================================', 'cyan'));
  console.log(colorize('   检查总结', 'cyan'));
  console.log(colorize('========================================\n', 'cyan'));

  console.log(`总命名空间数: ${summary.totalNamespaces}`);
  console.log(colorize(`✓ 通过: ${summary.successCount}`, 'green'));

  if (summary.failureCount > 0) {
    console.log(colorize(`✗ 失败: ${summary.failureCount}`, 'red'));
  }

  console.log(`\n总翻译键数: ${summary.totalKeys}`);

  if (summary.totalMissingKeys > 0) {
    console.log(colorize(`缺失键数: ${summary.totalMissingKeys}`, 'yellow'));
  }

  if (summary.totalVariableMismatches > 0) {
    console.log(colorize(`变量不匹配数: ${summary.totalVariableMismatches}`, 'red'));
  }

  console.log('');

  // 退出码
  if (totalSuccess) {
    console.log(colorize('✓ 所有翻译键结构完整一致！', 'green'));
    process.exit(0);
  } else {
    console.log(colorize('✗ 发现问题，请修复后重新检查。', 'red'));
    process.exit(1);
  }
}

// 执行
main();
