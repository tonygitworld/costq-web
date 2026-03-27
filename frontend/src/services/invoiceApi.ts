/**
 * Invoice API - 客户侧（只读）
 */
import { apiClient } from './apiClient';

export interface Invoice {
  id: string;
  invoice_number: string;
  version: number;
  period_year: number;
  period_month: number;
  cloud_cost_total: number;
  costq_fee: number;
  total_amount: number;
  currency: string;
  status: string;
  generated_at: string | null;
  created_at: string;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
}

export const invoiceApi = {
  list: () =>
    apiClient.get<InvoiceListResponse>('/api/v1/invoices'),

  download: (id: string) =>
    apiClient.get<{ download_url: string; expires_in: number }>(
      `/api/v1/invoices/${id}/download`
    ),
};
