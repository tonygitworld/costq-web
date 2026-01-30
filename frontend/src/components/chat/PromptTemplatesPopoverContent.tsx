import React, { useEffect, useState } from 'react';
import { Spin, Typography, Empty, Modal, Form, Input, InputNumber, Select, Button } from 'antd';
import { AppstoreOutlined, EditOutlined, StarFilled } from '@ant-design/icons';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useTemplateExecution } from '../../hooks/useTemplateExecution';
import { AllTemplatesModal } from './AllTemplatesModal';
import { CustomTemplateManager } from './CustomTemplateManager';
import { logger } from '../../utils/logger';

const { Text } = Typography;

// 标题简化映射
const getShortTitle = (title: string) => {
  if (!title) return '';

  if (title.includes('成本洞察')) return 'AWS 成本洞察';
  if (title.includes('RI/SP') && title.includes('数据')) return 'RI/SP 数据洞察';
  if (title.includes('多账户')) return '多账户成本对比';
  if (title.includes('归因')) return '成本归因分析';
  if (title.includes('利用率')) return 'RI/SP 利用率分析';
  if (title.includes('异常')) return '成本异常波动检测';
  if (title.includes('Savings Plans') || title.includes('购买建议')) return 'Savings Plans 购买建议';
  if (title.includes('未使用') || title.includes('闲置')) return '检测未使用的资源';
  if (title.includes('EC2') && title.includes('优化')) return 'EC2 实例优化建议';
  if (title.includes('本月') || title.includes('趋势')) return '查看本月成本趋势';

  return title;
};

// 简单的模板卡片组件
const SimpleTemplateCard = ({ template, onClick }: { template: any, onClick: (t: any) => void }) => (
  <div
    onClick={() => onClick(template)}
    className="simple-template-card"
    title={template.title}
  >
    <div className="card-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        {template.is_favorite && <StarFilled style={{ color: '#faad14', fontSize: 12, marginRight: 4 }} />}
        {getShortTitle(template.title)}
      </div>
    </div>
  </div>
);

export const PromptTemplatesPopoverContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    systemTemplates,
    userTemplates,
    loadSystemTemplates,
    loadUserTemplates,
    systemLoading,
  } = usePromptTemplateStore();

  const {
    selectedTemplate,
    variableForm,
    handleTemplateClick,
    handleVariableFormSubmit,
    closeVariableForm
  } = useTemplateExecution();

  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showCustomManager, setShowCustomManager] = useState(false);

  useEffect(() => {
    if (systemTemplates.length === 0) {
        loadSystemTemplates('cost');
        loadUserTemplates();
    }
  }, []);

  const onTemplateClick = (template: any) => {
    handleTemplateClick(template);
    if (!template.variables || template.variables.length === 0) {
        onClose?.();
    }
  };

  const onModalOk = () => {
      variableForm.submit();
      closeVariableForm();
      onClose?.();
  };

  // 优先展示收藏的，然后是系统模板，总共展示 8 个
  const favorites = userTemplates.filter(t => t.is_favorite);
  const displayTemplates = [...favorites, ...systemTemplates].slice(0, 8);

  return (
    <div style={{ width: 330, display: 'flex', flexDirection: 'column' }}>
      <div style={{
         maxHeight: 320,
         overflowY: 'auto',
         padding: '12px',
         display: 'grid',
         gridTemplateColumns: '1fr 1fr', // 两列布局
         gap: 8,
         scrollbarWidth: 'thin'
      }}>
        {systemLoading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
        ) : displayTemplates.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模板" /></div>
        ) : (
          displayTemplates.map(item => (
            <SimpleTemplateCard key={item.id} template={item} onClick={onTemplateClick} />
          ))
        )}
      </div>

      {/* 底部按钮区域 */}
      <div style={{
          padding: '8px 12px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#fafafa',
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8
      }}>
          <Button
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() => setShowAllTemplates(true)}
          >
            查看所有 ({systemTemplates.length + userTemplates.length})
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setShowCustomManager(true)}
          >
            自定义模板
          </Button>
      </div>

      {/* 变量填写 Modal */}
      <Modal
        title={`填写变量: ${selectedTemplate?.title}`}
        open={!!selectedTemplate}
        onOk={onModalOk}
        onCancel={closeVariableForm}
        destroyOnHidden
        zIndex={1100}
        width={400}
      >
        <Form
          form={variableForm}
          layout="vertical"
          onFinish={(values) => {
            handleVariableFormSubmit(values);
            closeVariableForm();
            onClose?.();
          }}
        >
          {selectedTemplate?.variables?.map(variable => (
            <Form.Item
              key={variable.name}
              label={variable.label || variable.name}
              name={variable.name}
              rules={[{ required: variable.required, message: '请输入此变量' }]}
              initialValue={variable.default_value}
              tooltip={variable.description}
            >
              {variable.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} />
              ) : variable.type === 'select' ? (
                <Select options={variable.options?.map(opt => ({ label: opt, value: opt }))} />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
          {(!selectedTemplate?.variables || selectedTemplate.variables.length === 0) && (
            <p>确认使用此模板？</p>
          )}
        </Form>
      </Modal>

      {/* 所有模板 Modal */}
      <AllTemplatesModal
        visible={showAllTemplates}
        onClose={() => setShowAllTemplates(false)}
        onSelect={(template: any) => {
            setShowAllTemplates(false);
            onTemplateClick(template);
        }}
        zIndex={1100}
      />

      {/* 自定义模板管理 Modal */}
      <CustomTemplateManager
        visible={showCustomManager}
        onClose={() => setShowCustomManager(false)}
        zIndex={1100}
      />

      <style>{`
        .simple-template-card {
            border: 1px solid #f0f0f0;
            border-radius: 6px;
            padding: 10px;
            cursor: pointer;
            transition: all 0.2s;
            background-color: #fff;
            height: 100%;
            min-height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .simple-template-card:hover {
            border-color: #1890ff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transform: translateY(-1px);
        }
        .card-content {
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .card-title {
            font-size: 13px;
            font-weight: 500;
            color: #262626;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-desc {
            font-size: 11px;
            color: #8c8c8c;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-align: center;
        }
        /* Dark mode support */
        :global(.dark) .simple-template-card {
            background-color: #1f1f1f;
            border-color: #303030;
        }
        :global(.dark) .card-title { color: #e5e5e5; }
        :global(.dark) .card-desc { color: #8c8c8c; }
        :global(.dark) .simple-template-card:hover {
            border-color: #177ddc;
            background-color: #262626;
        }
      `}</style>
    </div>
  );
};
