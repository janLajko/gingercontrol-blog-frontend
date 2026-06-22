export interface ManagedUser {
  id: number;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  provider: string;
  provider_sub: string;
  company_name?: string | null;
  job_title?: string | null;
  profile_completed: boolean;
  email_verified: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  source?: string | null;
  callsign?: string | null;
  language?: string | null;
  password: string;
  is_deleted: boolean;
}

export interface ManagedUserListQuery {
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface ManagedUserListResponse {
  items: ManagedUser[];
  page: number;
  page_size: number;
  total: number;
}

export interface ManagedUserCreateRequest {
  email_prefix: string;
  name?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  callsign?: string | null;
  language?: string | null;
}
