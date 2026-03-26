import { isBillingAdminApiError } from "@/app/lib/billing-admin-api";

export type BillingAdminActivityState =
  | "idle"
  | "loading"
  | "saving"
  | "syncing";

export interface BillingAdminResolvedError {
  code?: string;
  message: string;
  field_errors: Record<string, string>;
}

export function resolveBillingAdminError(
  error: unknown,
  fallback: string,
): BillingAdminResolvedError {
  if (isBillingAdminApiError(error)) {
    const code = error.detail?.code;
    const message =
      code === "stripe_sync_failed"
        ? `Stripe 同步失败：${error.detail?.message || error.message || fallback}`
        : error.detail?.message || error.message || fallback;

    return {
      code,
      message,
      field_errors: error.detail?.field_errors || {},
    };
  }

  return {
    message: error instanceof Error ? error.message : fallback,
    field_errors: {},
  };
}

export function getBillingAdminActivityMessage(
  state: Exclude<BillingAdminActivityState, "idle">,
  fallback?: string,
) {
  if (fallback) {
    return fallback;
  }

  switch (state) {
    case "loading":
      return "Loading...";
    case "saving":
      return "Saving...";
    case "syncing":
      return "Syncing...";
  }
}

export function hasBillingAdminFieldErrors(
  fieldErrors: Record<string, string>,
) {
  return Object.keys(fieldErrors).length > 0;
}
