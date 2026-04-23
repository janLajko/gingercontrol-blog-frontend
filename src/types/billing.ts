export type BillingProductFamily = "simulate" | "classification" | "system";

export type BillingProductType = "subscription" | "credit_pack";

export type BillingGrantMode = "unlimited" | "prepaid_quota";

export type BillingFeatureControlMode = "free" | "grant_required" | "blocked";

export type BillingRecurringInterval = "day" | "week" | "month" | "year";

export type BillingStripeSyncMode = "create" | "bind_existing";

export interface BillingProductConfigEntry {
  feature_key: string;
  grant_mode: BillingGrantMode;
  credits?: number | null;
}

export type BillingProductConfigJson = BillingProductConfigEntry[];

export interface BillingFeaturePolicy {
  feature_key: string;
  control_mode: BillingFeatureControlMode;
  name?: string | null;
  description?: string | null;
  active: boolean;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingFeaturePolicyListResponse {
  items: BillingFeaturePolicy[];
}

export interface BillingProduct {
  product_code: string;
  product_family: BillingProductFamily;
  name: string;
  description?: string | null;
  product_type: BillingProductType;
  stripe_product_id: string;
  stripe_price_id: string;
  active: boolean;
  sort_order: number;
  config_json: BillingProductConfigJson;
  created_at: string;
  updated_at: string;
}

export interface GrantPreview {
  feature_key: string;
  grant_mode: BillingGrantMode;
  granted_quantity: number | null;
}

export interface StripeCatalogInfo {
  stripe_product_id: string;
  stripe_price_id: string;
  currency: "usd";
  unit_amount: number;
  billing_scheme: string;
  recurring_interval?: BillingRecurringInterval | null;
  recurring_interval_count?: number | null;
  lookup_key?: string | null;
  active: boolean;
}

export interface BillingProductDetail extends BillingProduct {
  grant_preview: GrantPreview[];
  stripe_catalog?: StripeCatalogInfo | null;
}

export interface BillingProductListResponse {
  items: BillingProduct[];
  page: number;
  page_size: number;
  total: number;
}

export interface BillingProductListQuery {
  product_family?: BillingProductFamily;
  active?: boolean;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface BillingCreateStripePriceBase {
  currency: "usd";
  unit_amount: number;
  billing_scheme?: string;
  lookup_key?: string;
}

export interface BillingCreateStripePriceRecurring
  extends BillingCreateStripePriceBase {
  type: "recurring";
  recurring_interval: BillingRecurringInterval;
  recurring_interval_count: number;
}

export interface BillingCreateStripePriceOneTime
  extends BillingCreateStripePriceBase {
  type: "one_time";
}

export type BillingCreateStripePrice =
  | BillingCreateStripePriceRecurring
  | BillingCreateStripePriceOneTime;

export interface BillingCreateStripeSyncCreate {
  mode: "create";
  price: BillingCreateStripePrice;
}

export interface BillingCreateStripeSyncBindExisting {
  mode: "bind_existing";
  stripe_product_id: string;
  stripe_price_id: string;
}

export type BillingCreateStripeSync =
  | BillingCreateStripeSyncCreate
  | BillingCreateStripeSyncBindExisting;

export interface BillingCreateProductRequest {
  product_code: string;
  product_family: BillingProductFamily;
  name?: string;
  description?: string;
  product_type?: BillingProductType;
  active?: boolean;
  sort_order?: number;
  config_json?: BillingProductConfigJson;
  stripe_sync?: BillingCreateStripeSync;
}

export interface BillingUpdateStripePriceChangeDisabled {
  enabled: false;
}

export interface BillingUpdateStripePriceChangeRecurring {
  enabled: true;
  currency: "usd";
  unit_amount: number;
  billing_scheme?: string;
  type: "recurring";
  recurring_interval: BillingRecurringInterval;
  recurring_interval_count: number;
}

export interface BillingUpdateStripePriceChangeOneTime {
  enabled: true;
  currency: "usd";
  unit_amount: number;
  billing_scheme: string;
  type: "one_time";
}

export type BillingUpdateStripePriceChange =
  | BillingUpdateStripePriceChangeDisabled
  | BillingUpdateStripePriceChangeRecurring
  | BillingUpdateStripePriceChangeOneTime;

export interface BillingUpdateStripeSync {
  update_product: boolean;
  price_change?: BillingUpdateStripePriceChange;
}

export interface BillingUpdateProductRequest {
  name: string;
  description?: string;
  active: boolean;
  sort_order: number;
  config_json: BillingProductConfigJson;
  stripe_sync: BillingUpdateStripeSync;
}

export interface BillingPatchProductRequest {
  active: boolean;
}

export interface BillingSyncStripeRequest {
  sync_product: boolean;
  sync_price: boolean;
}

export interface BillingSyncStripeResponse {
  ok: boolean;
  product_code: string;
  stripe_product_id: string;
  stripe_price_id: string;
}

export interface BillingAdminErrorDetail {
  code: string;
  message: string;
  field_errors?: Record<string, string> | null;
}

export interface BillingAdminErrorResponse {
  detail: BillingAdminErrorDetail;
}

export interface BillingUserOption {
  user_id: number;
  email: string;
  name?: string | null;
  company_name?: string | null;
}

export interface BillingUserSearchResponse {
  items: BillingUserOption[];
}

export interface BillingManualGrantInput {
  feature_key: string;
  grant_mode: BillingGrantMode;
  quantity?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface BillingCreateManualPurchaseRequest {
  product_code: string;
  purchase_starts_at?: string | null;
  purchase_ends_at?: string | null;
  reason?: string;
  contract_no?: string;
  note?: string;
  grants: BillingManualGrantInput[];
}

export interface BillingGrantSnapshot {
  grant_id: number;
  purchase_id: number;
  feature_key: string;
  grant_mode: BillingGrantMode;
  granted_quantity?: number | null;
  remaining_quantity?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status: "active" | "expired" | "consumed" | "canceled";
  config_json: Record<string, unknown>;
}

export interface BillingPurchaseSnapshot {
  purchase_id: number;
  product_code: string;
  product_name: string;
  product_family: BillingProductFamily;
  purchase_type: string;
  status: "pending" | "active" | "expired" | "canceled" | "consumed" | "failed";
  purchased_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
  source?: string | null;
  reason?: string | null;
  contract_no?: string | null;
  note?: string | null;
  grants: BillingGrantSnapshot[];
}

export interface BillingFeatureBalanceSummary {
  feature_key: string;
  active_unlimited: boolean;
  total_granted: number;
  total_remaining: number;
}

export interface BillingUsageEventSnapshot {
  usage_event_id: number;
  feature_key: string;
  quantity: number;
  usage_status: string;
  created_at: string;
  committed_at?: string | null;
}

export interface BillingUserBillingSummaryResponse {
  user: BillingUserOption;
  balances: BillingFeatureBalanceSummary[];
  purchases: BillingPurchaseSnapshot[];
  recent_usage: BillingUsageEventSnapshot[];
}

export interface BillingCancelManualPurchaseRequest {
  reason?: string;
}
