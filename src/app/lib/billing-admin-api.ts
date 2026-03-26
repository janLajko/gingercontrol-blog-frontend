import type {
  BillingCreateProductRequest,
  BillingAdminErrorDetail,
  BillingAdminErrorResponse,
  BillingPatchProductRequest,
  BillingProduct,
  BillingProductDetail,
  BillingProductListQuery,
  BillingProductListResponse,
  BillingSyncStripeRequest,
  BillingSyncStripeResponse,
  BillingUpdateProductRequest,
} from "@/types/billing";

const DEFAULT_BILLING_ADMIN_BASE_URL = "/api/admin/billing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseBillingAdminErrorResponse(
  payload: unknown,
): BillingAdminErrorResponse | undefined {
  if (!isRecord(payload) || !isRecord(payload.detail)) {
    return undefined;
  }

  const { code, message, field_errors } = payload.detail;
  if (typeof code !== "string" || typeof message !== "string") {
    return undefined;
  }

  const normalizedFieldErrors =
    isRecord(field_errors)
      ? (Object.fromEntries(
          Object.entries(field_errors).filter(
            ([, value]) => typeof value === "string",
          ),
        ) as Record<string, string>)
      : undefined;

  return {
    detail: {
      code,
      message,
      field_errors: normalizedFieldErrors,
    },
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => undefined);
  }

  const text = await response.text();
  return text || undefined;
}

function buildListQuery(query?: BillingProductListQuery) {
  const searchParams = new URLSearchParams();

  if (query?.product_family !== undefined) {
    searchParams.set("product_family", query.product_family);
  }

  if (query?.active !== undefined) {
    searchParams.set("active", String(query.active));
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

export class BillingAdminApiError extends Error {
  readonly status: number;
  readonly detail?: BillingAdminErrorDetail;

  constructor(
    status: number,
    message: string,
    detail?: BillingAdminErrorDetail,
  ) {
    super(message);
    this.name = "BillingAdminApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isBillingAdminApiError(
  value: unknown,
): value is BillingAdminApiError {
  return value instanceof BillingAdminApiError;
}

export interface BillingAdminApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  headers?: HeadersInit;
}

export function createBillingAdminApiClient(
  options: BillingAdminApiClientOptions = {},
) {
  const {
    baseUrl = DEFAULT_BILLING_ADMIN_BASE_URL,
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
      const parsedError = parseBillingAdminErrorResponse(responseBody);
      throw new BillingAdminApiError(
        response.status,
        parsedError?.detail.message || response.statusText || "Request failed",
        parsedError?.detail,
      );
    }

    return responseBody as T;
  }

  return {
    listProducts(query?: BillingProductListQuery) {
      return request<BillingProductListResponse>(
        `/products${buildListQuery(query)}`,
      );
    },

    createProduct(body: BillingCreateProductRequest) {
      return request<BillingProduct>("/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    getProduct(product_code: string) {
      return request<BillingProductDetail>(
        `/products/${encodeURIComponent(product_code)}`,
      );
    },

    replaceProduct(product_code: string, body: BillingUpdateProductRequest) {
      return request<BillingProductDetail>(
        `/products/${encodeURIComponent(product_code)}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
    },

    patchProduct(product_code: string, body: BillingPatchProductRequest) {
      return request<BillingProduct>(
        `/products/${encodeURIComponent(product_code)}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
    },

    syncStripe(product_code: string, body: BillingSyncStripeRequest) {
      return request<BillingSyncStripeResponse>(
        `/products/${encodeURIComponent(product_code)}/sync-stripe`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
  };
}

export const billingAdminApiClient = createBillingAdminApiClient();
