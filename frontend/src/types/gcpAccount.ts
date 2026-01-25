// GCP 账号类型定义

export interface GCPAccount {
  id: string;
  account_name: string;
  project_id: string;
  service_account_email: string;
  service_account_email_masked: string;
  description?: string;
  is_verified: boolean;
  organization_id?: string;
  billing_account_id?: string;
  billing_export_project_id?: string;
  billing_export_dataset?: string;
  billing_export_table?: string;
  created_at: string;
  updated_at: string;
}

export interface GCPAccountFormData {
  account_name: string;
  service_account_json: object;
  description?: string;
  billing_export_project_id?: string;
  billing_export_dataset?: string;
  billing_export_table?: string;
}

export interface GCPAccountUpdateData {
  account_name?: string;
  description?: string;
  billing_export_project_id?: string;
  billing_export_dataset?: string;
  billing_export_table?: string;
}

export interface GCPCredentialValidationResult {
  valid: boolean;
  project_id?: string;
  service_account_email?: string;
  organization_id?: string;
  billing_account_id?: string;
  error?: string;
}
