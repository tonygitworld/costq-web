/**
 * PromptTemplateGrid - 提示词模板网格
 *
 * 展示多个模板卡片，处理点击和变量填写
 */

import React from 'react';
import { Modal, Form, Input, InputNumber, Select } from 'antd';
import { PromptTemplateCard } from './PromptTemplateCard';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';
import { useTemplateExecution } from '../../hooks/useTemplateExecution';

interface Props {
  templates: (PromptTemplate | UserPromptTemplate)[];
}

export const PromptTemplateGrid: React.FC<Props> = ({ templates }) => {
  const {
    selectedTemplate,
    variableForm,
    handleTemplateClick,
    handleVariableFormSubmit,
    closeVariableForm
  } = useTemplateExecution();

  return (
    <>
      {/* 单行横向滚动布局 */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 12,
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: 4,
        // 美化滚动条
        scrollbarWidth: 'thin',
        scrollbarColor: '#bfbfbf #f0f0f0'
      }}>
        {templates.map(template => (
          <div key={template.id} style={{ flexShrink: 0 }}>
            <PromptTemplateCard
              template={template}
              onClick={handleTemplateClick}
            />
          </div>
        ))}
      </div>

      {/* 滚动条样式 */}
      <style>{`
        div::-webkit-scrollbar {
          height: 6px;
        }
        div::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: #bfbfbf;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #999;
        }
      `}</style>

      {/* 变量填写表单 Modal */}
      <Modal
        title={`填写参数：${selectedTemplate?.title}`}
        open={!!selectedTemplate}
        onOk={() => variableForm.submit()}
        onCancel={closeVariableForm}
        okText="发送"
        cancelText="取消"
        width={500}
      >
        {selectedTemplate && (
          <Form
            form={variableForm}
            layout="vertical"
            onFinish={handleVariableFormSubmit}
          >
            {selectedTemplate.variables?.map(variable => (
              <Form.Item
                key={variable.name}
                label={variable.label}
                name={variable.name}
                rules={[
                  {
                    required: variable.required,
                    message: `请填写${variable.label}`
                  }
                ]}
              >
                {variable.type === 'text' && (
                  <Input placeholder={variable.placeholder || `请输入${variable.label}`} />
                )}
                {variable.type === 'number' && (
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder={variable.placeholder || `请输入${variable.label}`}
                  />
                )}
                {variable.type === 'select' && (
                  <Select placeholder={`请选择${variable.label}`}>
                    {variable.options?.map(opt => (
                      <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                    ))}
                  </Select>
                )}
              </Form.Item>
            ))}
          </Form>
        )}
      </Modal>
    </>
  );
};
