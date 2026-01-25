/**
 * AllTemplatesModal - 查看全部模板弹窗
 *
 * 显示所有系统模板，支持分类筛选和搜索
 */

import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Input, Empty, Spin, Form, InputNumber, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { PromptTemplateCard } from './PromptTemplateCard';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useTemplateExecution } from '../../hooks/useTemplateExecution';
import { useI18n } from '../../hooks/useI18n';

const { TabPane } = Tabs;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const AllTemplatesModal: React.FC<Props> = ({ visible, onClose }) => {
  const {
    systemTemplates,
    userTemplates,
    loadSystemTemplates,
    loadUserTemplates,
    systemLoading,
    userLoading
  } = usePromptTemplateStore();
  const {
    selectedTemplate,
    variableForm,
    handleTemplateClick,
    handleVariableFormSubmit,
    closeVariableForm
  } = useTemplateExecution();
  const { t } = useI18n(['template', 'common']);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    if (visible) {
      if (systemTemplates.length === 0) loadSystemTemplates('cost');
      loadUserTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 合并所有模板
  const allTemplates = [...userTemplates, ...systemTemplates];

  // 过滤模板
  const filteredTemplates = allTemplates.filter(template => {
    // 搜索过滤
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchTitle = template.title.toLowerCase().includes(search);
      const matchDesc = template.description?.toLowerCase().includes(search);
      if (!matchTitle && !matchDesc) return false;
    }

    // 分类过滤
    if (activeTab === 'all') return true;
    if (activeTab === 'my') return 'user_id' in template; // 用户模板有 user_id
    if (activeTab === 'aws') return 'cloud_provider' in template && template.cloud_provider === 'aws';
    if (activeTab === 'gcp') return 'cloud_provider' in template && template.cloud_provider === 'gcp';

    return true;
  });

  // 按云服务商分组统计
  const awsCount = systemTemplates.filter(t => t.cloud_provider === 'aws').length;
  const gcpCount = systemTemplates.filter(t => t.cloud_provider === 'gcp').length;
  const myCount = userTemplates.length;

  const loading = systemLoading || userLoading;

  return (
    <Modal
      title={t('allTemplates.title')}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('allTemplates.search')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: '100%' }}
        />
      </div>

      {/* 分类标签 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={`${t('allTemplates.all')} (${allTemplates.length})`} key="all" />
        <TabPane tab={`我的模板 (${myCount})`} key="my" />
        <TabPane tab={`${t('allTemplates.awsTemplates')} (${awsCount})`} key="aws" />
        <TabPane tab={`${t('allTemplates.gcpTemplates')} (${gcpCount})`} key="gcp" />
      </Tabs>

      {/* 模板列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip={t('allTemplates.loading')} />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Empty
          description={searchText ? t('allTemplates.noResultsWithSearch', { search: searchText }) : t('allTemplates.noResults')}
          style={{ padding: '40px 0' }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
            padding: '8px 0'
          }}
        >
          {filteredTemplates.map(template => (
            <PromptTemplateCard
              key={template.id}
              template={template}
              onClick={(t) => {
                handleTemplateClick(t);
                // 如果没有变量，立即关闭弹窗
                if (!t.variables || t.variables.length === 0) {
                  onClose();
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 底部统计 */}
      {!systemLoading && filteredTemplates.length > 0 && (
        <div style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
          color: '#8c8c8c',
          fontSize: 13
        }}>
          {t('allTemplates.showing', { count: filteredTemplates.length })}
        </div>
      )}

      {/* 变量填写表单 Modal */}
      {selectedTemplate && (
        <Modal
          title={`填写参数：${selectedTemplate.title}`}
          open={!!selectedTemplate}
          onOk={() => {
            variableForm.submit();
            // 提交后关闭主弹窗
            onClose();
          }}
          onCancel={closeVariableForm}
          okText={t('common:button.submit')}
          cancelText={t('common:button.cancel')}
          width={500}
        >
          <Form
            form={variableForm}
            layout="vertical"
            onFinish={(values) => {
              handleVariableFormSubmit(values);
              onClose();
            }}
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
        </Modal>
      )}
    </Modal>
  );
};
