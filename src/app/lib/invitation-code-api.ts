import type {
  InvitationCode,
  InvitationCodeCreateRequest,
  InvitationCodeListQuery,
  InvitationCodeListResponse,
  InvitationCodePatchRequest,
  InvitationCodeUsageListResponse,
} from "@/types/invitation-code";

const DEFAULT_INVITATION_CODE_BASE_URL = "/api/admin/invitation-codes";

interface ApiErrorDetail {
  code?: string;
  message: string;
}

export class InvitationCodeApiError extends Error {
  readonly status: number;
  readonly detail?: ApiErrorDetail;

  constructor(status: number, message: string, detail?: ApiErrorDetail) {
    super(message);
    this.name = "InvitationCodeApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isInvitationCodeApiError(
  value: unknown,
): value is InvitationCodeApiError {
  return value instanceof InvitationCodeApiError;
}

export interface InvitationCodeApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  headers?: HeadersInit;
}

function buildListQuery(query?: InvitationCodeListQuery) {
  const searchParams = new URLSearchParams();

  if (query?.code_type) {
    searchParams.set("code_type", query.code_type);
  }

  if (query?.status) {
    searchParams.set("status", query.status);
  }

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

export function createInvitationCodeApiClient(
  options: InvitationCodeApiClientOptions = {},
) {
  const {
    baseUrl = DEFAULT_INVITATION_CODE_BASE_URL,
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
      throw new InvitationCodeApiError(
        response.status,
        parsedError?.message || response.statusText || "Request failed",
        parsedError,
      );
    }

    return responseBody as T;
  }

  return {
    listCodes(query?: InvitationCodeListQuery) {
      return request<InvitationCodeListResponse>(buildListQuery(query));
    },

    createCode(body: InvitationCodeCreateRequest) {
      return request<InvitationCode>("", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    getCode(id: number) {
      return request<InvitationCode>(`/${encodeURIComponent(String(id))}`);
    },

    patchCode(id: number, body: InvitationCodePatchRequest) {
      return request<InvitationCode>(`/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },

    deleteCode(id: number) {
      return request<{ deleted: boolean; id: number }>(
        `/${encodeURIComponent(String(id))}`,
        {
          method: "DELETE",
        },
      );
    },

    listUsages(id: number, page = 1, pageSize = 20) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      return request<InvitationCodeUsageListResponse>(
        `/${encodeURIComponent(String(id))}/usages?${params.toString()}`,
      );
    },
  };
}

export const invitationCodeApiClient = createInvitationCodeApiClient();
