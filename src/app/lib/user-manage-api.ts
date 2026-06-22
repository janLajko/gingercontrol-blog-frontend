import type {
  ManagedUser,
  ManagedUserCreateRequest,
  ManagedUserListQuery,
  ManagedUserListResponse,
} from "@/types/user-manage";

const DEFAULT_USER_MANAGE_BASE_URL = "/api/admin/users";

interface ApiErrorDetail {
  code?: string;
  message: string;
}

export class UserManageApiError extends Error {
  readonly status: number;
  readonly detail?: ApiErrorDetail;

  constructor(status: number, message: string, detail?: ApiErrorDetail) {
    super(message);
    this.name = "UserManageApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isUserManageApiError(value: unknown): value is UserManageApiError {
  return value instanceof UserManageApiError;
}

export interface UserManageApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  headers?: HeadersInit;
}

function buildListQuery(query?: ManagedUserListQuery) {
  const searchParams = new URLSearchParams();

  if (query?.keyword) {
    searchParams.set("keyword", query.keyword);
  }

  if (query?.page !== undefined) {
    searchParams.set("page", String(query.page));
  }

  if (query?.page_size !== undefined) {
    searchParams.set("page_size", String(query.page_size));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => undefined);
  }

  const text = await response.text();
  return text || undefined;
}

function parseApiError(payload: unknown): ApiErrorDetail | undefined {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return undefined;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return { message: detail };
  }

  if (typeof detail === "object" && detail !== null && "message" in detail) {
    const record = detail as { code?: unknown; message?: unknown };
    if (typeof record.message === "string") {
      return {
        code: typeof record.code === "string" ? record.code : undefined,
        message: record.message,
      };
    }
  }

  return undefined;
}

export function createUserManageApiClient(
  options: UserManageApiClientOptions = {},
) {
  const {
    baseUrl = DEFAULT_USER_MANAGE_BASE_URL,
    fetcher = fetch,
    headers: defaultHeaders,
  } = options;

  async function request<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(defaultHeaders);

    if (init.headers) {
      const requestHeaders = new Headers(init.headers);
      requestHeaders.forEach((value, key) => headers.set(key, value));
    }

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      const parsedError = parseApiError(responseBody);
      throw new UserManageApiError(
        response.status,
        parsedError?.message || response.statusText || "Request failed",
        parsedError,
      );
    }

    return responseBody as T;
  }

  return {
    listUsers(query?: ManagedUserListQuery) {
      return request<ManagedUserListResponse>(buildListQuery(query));
    },

    createUser(body: ManagedUserCreateRequest) {
      return request<ManagedUser>("", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    getUser(id: number) {
      return request<ManagedUser>(`/${encodeURIComponent(String(id))}`);
    },

    deleteUser(id: number) {
      return request<{ deleted: boolean; id: number }>(
        `/${encodeURIComponent(String(id))}`,
        { method: "DELETE" },
      );
    },
  };
}

export const userManageApiClient = createUserManageApiClient();
