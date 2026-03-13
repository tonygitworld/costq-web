import React from 'react';
import { Spin, Empty, Pagination, Button } from 'antd';
import './CardListView.css';

/** 字段配置 */
export interface CardField<T> {
  /** 字段标签（显示名称） */
  label: string;
  /** 数据源中的字段 key */
  key: keyof T | string;
  /** 自定义渲染函数，优先级高于默认的文本渲染 */
  render?: (value: any, record: T) => React.ReactNode;
  /** 是否全宽显示（label 在上，value 在下） */
  fullWidth?: boolean;
}

/** 操作按钮配置 */
export interface CardAction<T> {
  /** 按钮文本 */
  label: string;
  /** Ant Design 图标 */
  icon?: React.ReactNode;
  /** 点击回调 */
  onClick: (record: T) => void;
  /** 是否为危险操作（红色按钮） */
  danger?: boolean;
  /** 动态控制按钮是否可见 */
  hidden?: (record: T) => boolean;
  /** 动态控制 loading 状态 */
  loading?: (record: T) => boolean;
}

/** CardListView Props */
export interface CardListViewProps<T> {
  /** 数据源 */
  dataSource?: T[];
  /** 每条数据的唯一标识字段 */
  rowKey: keyof T | ((record: T) => string);
  /** 卡片中展示的字段配置列表 */
  fields: CardField<T>[];
  /** 卡片中的操作按钮配置列表 */
  actions?: CardAction<T>[];
  /** 是否处于加载状态 */
  loading?: boolean;
  /** 分页配置，传入 false 禁用分页 */
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
    showTotal?: (total: number) => string;
  } | false;
  /** 空状态描述文本 */
  emptyText?: string;
}

function getRowKey<T>(record: T, rowKey: keyof T | ((record: T) => string)): string {
  if (typeof rowKey === 'function') {
    return rowKey(record);
  }
  return String(record[rowKey]);
}

function renderFieldValue<T>(field: CardField<T>, record: T): React.ReactNode {
  if (field.render) {
    try {
      return field.render((record as any)[field.key as string], record);
    } catch (err) {
      console.error('CardListView field render error:', err);
      return '-';
    }
  }
  const value = (record as any)[field.key as string];
  return value !== undefined && value !== null ? String(value) : '-';
}

export function CardListView<T>({
  dataSource,
  rowKey,
  fields,
  actions,
  loading = false,
  pagination,
  emptyText,
}: CardListViewProps<T>) {
  const allData = dataSource ?? [];

  // 在组件内部做分页切片，确保只渲染当前页的数据
  const data = pagination
    ? allData.slice(
        (pagination.current - 1) * pagination.pageSize,
        pagination.current * pagination.pageSize
      )
    : allData;

  const content = allData.length === 0 ? (
    <div className="card-list-view-empty">
      <Empty description={emptyText} />
    </div>
  ) : (
    <div className="card-list-view">
      {data.map((record) => {
        const key = getRowKey(record, rowKey);
        const visibleActions = actions?.filter((a) => !a.hidden?.(record));
        const [headerField, ...bodyFields] = fields;

        return (
          <div key={key} className="card-list-view-card" data-testid="card-item">
            {headerField && (
              <div className="card-list-view-card-header">
                <span className="card-list-view-card-header-title">
                  {renderFieldValue(headerField, record)}
                </span>
                {bodyFields.length > 0 && (bodyFields[bodyFields.length - 1].key === 'is_verified' || bodyFields[bodyFields.length - 1].key === 'is_active') ? (
                  <span className="card-list-view-card-header-badge">
                    {renderFieldValue(bodyFields[bodyFields.length - 1], record)}
                  </span>
                ) : null}
              </div>
            )}
            <div className="card-list-view-fields">
              {bodyFields.map((field, idx) => {
                // Skip the last field if it was rendered as badge in header
                if (idx === bodyFields.length - 1 && (field.key === 'is_verified' || field.key === 'is_active')) {
                  return null;
                }
                if (field.fullWidth) {
                  return (
                    <div key={String(field.key)} className="card-list-view-field card-list-view-field-full">
                      <span className="card-list-view-field-label">{field.label}</span>
                      <span className="card-list-view-field-value-full">
                        {renderFieldValue(field, record)}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={String(field.key)} className="card-list-view-field">
                    <span className="card-list-view-field-label">{field.label}</span>
                    <span className="card-list-view-field-value">
                      {renderFieldValue(field, record)}
                    </span>
                  </div>
                );
              })}
            </div>
            {visibleActions && visibleActions.length > 0 && (
              <div className="card-list-view-actions">
                {visibleActions.map((action) => (
                  <Button
                    key={action.label}
                    size="small"
                    icon={action.icon}
                    danger={action.danger}
                    loading={action.loading?.(record)}
                    onClick={() => action.onClick(record)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Spin spinning={loading}>
      {content}
      {pagination && (
        <div className="card-list-view-pagination">
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={pagination.onChange}
            showTotal={pagination.showTotal}
            size="small"
            hideOnSinglePage
            showSizeChanger
            pageSizeOptions={['5', '10', '20', '50']}
          />
        </div>
      )}
    </Spin>
  );
}
