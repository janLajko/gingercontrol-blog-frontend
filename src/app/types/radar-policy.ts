export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ImpactedType =
  | "deleted"
  | "inserted"
  | "measure_changed"
  | "desc_changed"
  | "rate_changed";

export interface RadarImpactRow {
  policy_update_id?: number;
  hts_number: string;
  impacted_type: ImpactedType;
  effective_time: string | null;
  coos: string[] | null;
  row_desc: string | null;
}

export interface RadarPolicyUpdateSummary {
  id: number;
  source_key: string;
  source_label: string;
  source_url: string;
  source_title: string;
  headline: string;
  published_at: string | null;
  effective_date: string | null;
  policy_extract_status: string;
  policy_review_status: string;
  action_calculate_status: string;
  created_at: string;
  updated_at: string;
  measures_count: number;
  scope_sets_count: number;
  hts_modifications_count: number;
}

export interface RadarPolicyUpdateDetail extends RadarPolicyUpdateSummary {
  source_metadata: JsonValue;
  summary: string;
  briefing: string;
  impact_json: JsonValue | null;
}

export interface RadarPreviewResponse {
  impacts: RadarImpactRow[];
  count: number;
}
