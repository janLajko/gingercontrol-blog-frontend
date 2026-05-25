export type InvitationCodeType = "radar" | "register" | "sandbox";

export type InvitationCodeStatus = "active" | "disabled" | "expired" | "exhausted";

export interface InvitationCode {
  id: number;
  code: string;
  code_type: InvitationCodeType;
  prefix: string;
  code_length: number;
  max_uses: number;
  used_count: number;
  valid_from?: string | null;
  valid_until?: string | null;
  status: InvitationCodeStatus;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  disabled_at?: string | null;
}

export interface InvitationCodeUsage {
  id: number;
  code: string;
  user_id: string;
  used_at: string;
}

export interface InvitationCodeListQuery {
  code_type?: InvitationCodeType;
  status?: InvitationCodeStatus;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface InvitationCodeListResponse {
  items: InvitationCode[];
  page: number;
  page_size: number;
  total: number;
}

export interface InvitationCodeUsageListResponse {
  items: InvitationCodeUsage[];
  page: number;
  page_size: number;
  total: number;
}

export interface InvitationCodeCreateRequest {
  code?: string | null;
  code_type: InvitationCodeType;
  prefix?: string;
  code_length: number;
  max_uses?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  status?: InvitationCodeStatus;
  note?: string | null;
  created_by?: string | null;
}

export interface InvitationCodePatchRequest {
  code_type?: InvitationCodeType;
  prefix?: string;
  code_length?: number;
  max_uses?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  status?: InvitationCodeStatus;
  note?: string | null;
}
