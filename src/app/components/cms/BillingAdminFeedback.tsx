"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";

import type { BillingAdminActivityState } from "@/app/lib/billing-admin-feedback";
import { getBillingAdminActivityMessage } from "@/app/lib/billing-admin-feedback";
import { cn } from "@/app/lib/utils";

interface BillingAdminFeedbackProps {
  activity?:
    | {
        state: Exclude<BillingAdminActivityState, "idle">;
        message?: string;
      }
    | null;
  successMessage?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  className?: string;
}

export function BillingAdminFeedback({
  activity,
  successMessage,
  errorMessage,
  errorCode,
  className,
}: BillingAdminFeedbackProps) {
  if (!activity && !successMessage && !errorMessage) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {activity ? (
        <FeedbackCard
          icon={LoaderCircle}
          tone="info"
          message={getBillingAdminActivityMessage(
            activity.state,
            activity.message,
          )}
          iconClassName="animate-spin"
        />
      ) : null}

      {successMessage ? (
        <FeedbackCard
          icon={CheckCircle2}
          tone="success"
          message={successMessage}
        />
      ) : null}

      {errorMessage ? (
        <FeedbackCard
          icon={AlertTriangle}
          tone="error"
          message={errorMessage}
          code={errorCode}
        />
      ) : null}
    </div>
  );
}

export function BillingAdminFieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return <p className="mt-2 text-sm text-red-600">{error}</p>;
}

function FeedbackCard({
  icon: Icon,
  tone,
  message,
  code,
  iconClassName,
}: {
  icon: LucideIcon;
  tone: "info" | "success" | "error";
  message: string;
  code?: string | null;
  iconClassName?: string;
}) {
  const styles =
    tone === "success"
      ? {
          wrapper: "border-emerald-200 bg-emerald-50 text-emerald-900",
          badge: "border-emerald-300/80 bg-emerald-100 text-emerald-800",
        }
      : tone === "error"
        ? {
            wrapper: "border-red-200 bg-red-50 text-red-900",
            badge: "border-red-300/80 bg-red-100 text-red-800",
          }
        : {
            wrapper: "border-sky-200 bg-sky-50 text-sky-900",
            badge: "border-sky-300/80 bg-sky-100 text-sky-800",
          };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm",
        styles.wrapper,
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconClassName)} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {code ? (
          <div className="mt-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                styles.badge,
              )}
            >
              {code}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
