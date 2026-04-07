import React, { useEffect, useState } from 'react';
import { Spin, Empty, Modal, Form, Input, InputNumber, Select, Button, message, Space } from 'antd';
import { AppstoreOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useTemplateExecution } from '../../hooks/useTemplateExecution';
import { AllTemplatesModal } from './AllTemplatesModal';
import { CustomTemplateManager } from './CustomTemplateManager';
import { PromptTemplateCard } from './PromptTemplateCard';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTemplateUse = (template: PromptTemplate | UserPromptTemplate) => {
    handleTemplateClick(template);
    if (!template.variables || template.variables.length === 0) {
      onClose?.();
    }
  };

  const handleTemplateCopy = async (template: PromptTemplate | UserPromptTemplate) => {
    try {
      await navigator.clipboard.writeText(template.prompt_text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const favorites = userTemplates.filter(t => t.is_favorite);
  const displayTemplates = [...favorites, ...systemTemplates].slice(0, 8);

  return (
    <div style={{ width: 330, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        maxHeight: 320,
        overflowY: 'auto',
        padding: '12px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        scrollbarWidth: 'thin'
      }}>
        {systemLoading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
          </div>
        ) : displayTemplates.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模板" />
          </div>
        ) : (
          displayTemplates.map(item => (
            <PromptTemplateCard
              key={item.id}
              template={item}
              onClick={handleTemplateUse}
              style={{ width: '100%' }}
              actions={(
                <Space size={4} wrap>
                  <Button
                    size="small"
                    type="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateUse(item);
                    }}
                  >
                    使用
                  </Button>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateCopy(item);
                    }}
                  >
                    复制
                  </Button>
                </Space>
              )}
            />
          ))
        )}
      </div>

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

      <Modal
        title={`填写变量: ${selectedTemplate?.title}`}
        open={!!selectedTemplate}
        onOk={() => {
          variableForm.submit();
          closeVariableForm();
          onClose?.();
        }}
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
              rules={[{ required: variable.required, message: '请输入该变量' }]}
              initialValue={variable.default}
              tooltip={variable.placeholder}
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

      <AllTemplatesModal
        visible={showAllTemplates}
        onClose={() => setShowAllTemplates(false)}
        onSelect={(template: PromptTemplate | UserPromptTemplate) => {
          setShowAllTemplates(false);
          handleTemplateUse(template);
        }}
        zIndex={1100}
      />

      <CustomTemplateManager
        visible={showCustomManager}
        onClose={() => setShowCustomManager(false)}
        zIndex={1100}
      />
    </div>
  );
};
