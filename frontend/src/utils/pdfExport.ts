// PDF导出工具 - 使用jsPDF直接生成PDF文件
import { jsPDF } from 'jspdf';
// @ts-expect-error - jspdf-font没有类型定义
import initFont from 'jspdf-font';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

import { logger } from './logger';
import i18n from '../i18n';

// 全局初始化中文字体（只需执行一次）
let fontInitialized = false;

/**
 * 检测是否是Markdown表格行
 */
const isTableRow = (line: string): boolean => {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
};

/**
 * 检测是否是表格分隔线
 */
const isTableSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  return /^\|[\s\-:]+\|$/.test(trimmed) && trimmed.includes('-');
};

/**
 * 解析Markdown表格
 */
const parseMarkdownTable = (lines: string[], startIndex: number): { rows: string[][], endIndex: number } => {
  const rows: string[][] = [];
  let i = startIndex;

  while (i < lines.length && isTableRow(lines[i])) {
    const line = lines[i].trim();

    // 跳过分隔线
    if (isTableSeparator(line)) {
      i++;
      continue;
    }

    // 解析表格行
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim());

    // 双重检查：过滤掉可能漏掉的分隔线
    const isSeparatorRow = cells.every(cell =>
      /^[\s\-:]*$/.test(cell) && cell.includes('-')
    );

    if (!isSeparatorRow && cells.length > 0 && cells.some(cell => cell.length > 0)) {
      rows.push(cells);
    }
    i++;
  }

  return { rows, endIndex: i - 1 };
};

/**
 * 将消息内容导出为PDF并直接下载
 */
export const exportMessageToPDF = (content: string, timestamp: number) => {
  try {
    // 初始化中文字体支持（全局初始化）
    if (!fontInitialized) {
      initFont(jsPDF.API, 'SongtiSCBlack');
      fontInitialized = true;
    }

    // 创建PDF文档 (A4尺寸)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 页面配置
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // 设置字体
    doc.setFont('SongtiSCBlack');

    // 添加标题
    doc.setFontSize(18);
    doc.setTextColor(102, 126, 234);
    doc.text(i18n.t('chat:pdf.title'), margin, yPosition);
    yPosition += 10;

    // 添加时间戳
    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102);
    const dateFormat = i18n.t('chat:pdf.dateFormat');
    doc.text(`${i18n.t('chat:pdf.generatedAt')}: ${dayjs(timestamp).format(dateFormat)}`, margin, yPosition);
    yPosition += 5;

    // 添加分隔线
    doc.setDrawColor(102, 126, 234);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // 重置文本颜色和字号
    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);

    // 处理内容
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检查是否需要换页
      if (yPosition > pageHeight - margin - 10) {
        doc.addPage();
        yPosition = margin;
        doc.setFont('SongtiSCBlack');
      }

      // 处理各种格式
      if (line.startsWith('# ')) {
        // H1 标题
        doc.setFontSize(16);
        const text = line.substring(2);
        const wrappedText = doc.splitTextToSize(text, contentWidth);
        doc.text(wrappedText, margin, yPosition);
        yPosition += wrappedText.length * 8;
        doc.setFontSize(11);
      } else if (line.startsWith('## ')) {
        // H2 标题
        doc.setFontSize(14);
        const text = line.substring(3);
        const wrappedText = doc.splitTextToSize(text, contentWidth);
        doc.text(wrappedText, margin, yPosition);
        yPosition += wrappedText.length * 7;
        doc.setFontSize(11);
      } else if (line.startsWith('### ')) {
        // H3 标题
        doc.setFontSize(12);
        const text = line.substring(4);
        const wrappedText = doc.splitTextToSize(text, contentWidth);
        doc.text(wrappedText, margin, yPosition);
        yPosition += wrappedText.length * 6;
        doc.setFontSize(11);
      } else if (line.startsWith('```')) {
        // 代码块
        doc.setFillColor(246, 248, 250);
        doc.setFontSize(9);

        let codeContent = '';
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeContent += lines[i] + '\n';
          i++;
        }

        const codeLines = doc.splitTextToSize(codeContent, contentWidth - 4);
        const codeBlockHeight = codeLines.length * 5 + 4;

        if (yPosition + codeBlockHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          doc.setFont('SongtiSCBlack');
        }

        doc.rect(margin, yPosition - 3, contentWidth, codeBlockHeight, 'F');
        doc.text(codeLines, margin + 2, yPosition);
        yPosition += codeBlockHeight + 2;

        doc.setFontSize(11);
      } else if (isTableRow(line)) {
        // Markdown 表格
        const { rows, endIndex } = parseMarkdownTable(lines, i);

        if (rows.length > 0) {
          autoTable(doc, {
            head: [rows[0]],
            body: rows.slice(1),
            startY: yPosition,
            margin: { left: margin, right: margin },
            styles: {
              font: 'SongtiSCBlack',
              fontSize: 10,
              cellPadding: 3,
              lineColor: [200, 200, 200],
              lineWidth: 0.1,
            },
            headStyles: {
              fillColor: [102, 126, 234],
              textColor: [255, 255, 255],
              fontStyle: 'normal',
              halign: 'center',
            },
            bodyStyles: {
              textColor: [51, 51, 51],
            },
            alternateRowStyles: {
              fillColor: [248, 249, 250],
            },
            theme: 'grid',
          });

          // @ts-expect-error - autoTable会添加lastAutoTable属性
          yPosition = doc.lastAutoTable.finalY + 5;
          i = endIndex;
        }
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        // 列表项
        const text = '• ' + line.substring(2);
        const wrappedText = doc.splitTextToSize(text, contentWidth - 5);
        doc.text(wrappedText, margin + 5, yPosition);
        yPosition += wrappedText.length * 5;
      } else if (line.match(/^\d+\. /)) {
        // 有序列表
        const wrappedText = doc.splitTextToSize(line, contentWidth - 5);
        doc.text(wrappedText, margin + 5, yPosition);
        yPosition += wrappedText.length * 5;
      } else if (line.startsWith('> ')) {
        // 引用
        doc.setTextColor(102, 102, 102);
        const text = line.substring(2);
        const wrappedText = doc.splitTextToSize(text, contentWidth - 8);

        doc.setDrawColor(102, 126, 234);
        doc.setLineWidth(1);
        doc.line(margin, yPosition - 3, margin, yPosition + wrappedText.length * 5 - 1);

        doc.text(wrappedText, margin + 4, yPosition);
        yPosition += wrappedText.length * 5;
        doc.setTextColor(51, 51, 51);
      } else if (line.trim() === '---') {
        // 分隔线
        doc.setDrawColor(232, 232, 232);
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      } else if (line.trim() === '') {
        // 空行
        yPosition += 3;
      } else {
        // 普通段落
        let processedLine = line;
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '$1');
        processedLine = processedLine.replace(/\*(.*?)\*/g, '$1');
        processedLine = processedLine.replace(/`(.*?)`/g, '$1');

        const wrappedText = doc.splitTextToSize(processedLine, contentWidth);
        doc.text(wrappedText, margin, yPosition);
        yPosition += wrappedText.length * 5 + 2;
      }
    }

    // 生成文件名
    const filename = `AI回复-${dayjs(timestamp).format('YYYYMMDD-HHmmss')}.pdf`;

    // 直接下载PDF文件
    doc.save(filename);

  } catch (error) {
    logger.error('PDF生成失败:', error);
    alert(i18n.t('error:pdf.generationFailed'));
  }
};
