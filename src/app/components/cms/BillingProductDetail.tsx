"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Pencil,
  RefreshCcw,
} from "lucide-react";

import { BillingAdminFeedback } from "@/app/components/cms/BillingAdminFeedback";
import { billingAdminApiClient } from "@/app/lib/billing-admin-api";
import { resolveBillingAdminError } from "@/app/lib/billing-admin-feedback";
import type { BillingProductDetail as BillingProductDetailType } from "@/types/billing";

interface BillingProductDetailProps {
  product_code: string;
}

export default function BillingProductDetail({
  product_code,
}: BillingProductDetailProps) {
  const [product, setProduct] = useState<BillingProductDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  async function loadProduct() {
    try {
      setLoading(true);
      setErrorMessage(null);
      setErrorCode(null);
      const data = await billingAdminApiClient.getProduct(product_code);
      setProduct(data);
    } catch (loadError) {
      const resolved = resolveBillingAdminError(
        loadError,
        "Failed to load billing product",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProduct();
  }, [product_code]);

  async function handleToggleActive() {
    if (!product) {
      return;
    }

    const nextActive = !product.active;
    const confirmed = window.confirm(
      nextActive
        ? `确认重新启用 ${product.product_code} 吗？`
        : `确认下线 ${product.product_code} 吗？`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionKey("toggle");
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);

      await billingAdminApiClient.patchProduct(product.product_code, {
        active: nextActive,
      });
      await loadProduct();
      setSuccessMessage(
        nextActive
          ? `${product.product_code} 已上线`
          : `${product.product_code} 已下线`,
      );
    } catch (actionError) {
      const resolved = resolveBillingAdminError(
        actionError,
        "Failed to update active",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
    } finally {
      setActionKey(null);
    }
  }

  async function handleSyncStripe() {
    if (!product) {
      return;
    }

    try {
      setActionKey("sync");
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);

      await billingAdminApiClient.syncStripe(product.product_code, {
        sync_product: true,
        sync_price: true,
      });
      await loadProduct();
      setSuccessMessage(`${product.product_code} 已手动同步 Stripe`);
    } catch (actionError) {
      const resolved = resolveBillingAdminError(
        actionError,
        "Failed to sync Stripe",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
    } finally {
      setActionKey(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <BillingAdminFeedback
          activity={{
            state: "loading",
            message: "Loading billing product detail...",
          }}
        />
      </section>
    );
  }

  if (errorMessage || !product) {
    return (
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Billing Product Detail
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              {decodeURIComponent(product_code)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadProduct()}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </button>
        </div>

        <BillingAdminFeedback
          className="mt-6"
          errorMessage={errorMessage || "Billing product not found."}
          errorCode={errorCode}
        />
      </section>
    );
  }

  const hasActiveMismatch = product.active !== product.stripe_catalog.active;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/cms/billing/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Billing Product 列表
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Billing Product Detail
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{product.product_code}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/cms/billing/products/${encodeURIComponent(product.product_code)}/edit`}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <Pencil className="h-4 w-4" />
              编辑
            </Link>
            <button
              type="button"
              disabled={actionKey !== null}
              onClick={() => void handleToggleActive()}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionKey === "toggle"
                ? "处理中..."
                : product.active
                  ? "下线"
                  : "上线"}
            </button>
            <button
              type="button"
              disabled={actionKey !== null}
              onClick={() => void handleSyncStripe()}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              {actionKey === "sync" ? "同步中..." : "手动同步 Stripe"}
            </button>
            <button
              type="button"
              onClick={() => void loadProduct()}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {hasActiveMismatch ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">本地与 Stripe 状态不一致</p>
              <p className="mt-1 text-sm">
                local active = {String(product.active)}，stripe_catalog.active ={" "}
                {String(product.stripe_catalog.active)}
              </p>
            </div>
          </div>
        ) : null}

        <BillingAdminFeedback
          className="mt-6"
          activity={
            actionKey === "sync"
              ? {
                  state: "syncing",
                  message: "Syncing Stripe catalog...",
                }
              : actionKey === "toggle"
                ? {
                    state: "saving",
                    message: "Saving product active state...",
                  }
                : null
          }
          successMessage={successMessage}
          errorMessage={errorMessage}
          errorCode={errorCode}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <InfoSection
          eyebrow="Local Fields"
          title="基础信息"
          description="这一组展示本地 Billing Product 字段。"
        >
          <InfoGrid
            items={[
              ["product_code", product.product_code],
              ["product_family", product.product_family],
              ["name", product.name],
              ["description", product.description || "-"],
              ["product_type", product.product_type],
              ["active", String(product.active)],
              ["sort_order", String(product.sort_order)],
              ["stripe_product_id", product.stripe_product_id],
              ["stripe_price_id", product.stripe_price_id],
              ["created_at", formatDateTime(product.created_at)],
              ["updated_at", formatDateTime(product.updated_at)],
            ]}
          />
        </InfoSection>

        <InfoSection
          eyebrow="Stripe Catalog"
          title="Stripe 信息"
          description="这一组只展示 stripe_catalog 返回的 Stripe 字段。"
        >
          <InfoGrid
            items={[
              ["stripe_product_id", product.stripe_catalog.stripe_product_id],
              ["stripe_price_id", product.stripe_catalog.stripe_price_id],
              ["currency", product.stripe_catalog.currency],
              ["unit_amount", String(product.stripe_catalog.unit_amount)],
              ["billing_scheme", product.stripe_catalog.billing_scheme],
              [
                "recurring_interval",
                product.stripe_catalog.recurring_interval || "-",
              ],
              [
                "recurring_interval_count",
                product.stripe_catalog.recurring_interval_count != null
                  ? String(product.stripe_catalog.recurring_interval_count)
                  : "-",
              ],
              ["lookup_key", product.stripe_catalog.lookup_key || "-"],
              ["active", String(product.stripe_catalog.active)],
            ]}
          />
        </InfoSection>
      </section>

      <InfoSection
        eyebrow="Entitlement"
        title="Entitlement / config_json / grant_preview"
        description="这一组展示 entitlement 语义、config_json 原始结构和 grant_preview。"
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                config_json
              </p>
              {product.config_json.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500">
                  No config_json returned.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {product.config_json.map((configEntry, index) => (
                    <div
                      key={`${configEntry.feature_key}:${index}`}
                      className="rounded-2xl border border-black/8 bg-white px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        config_json.{index}
                      </p>
                      <div className="mt-3">
                        <InfoGrid
                          items={[
                            ["feature_key", configEntry.feature_key],
                            ["grant_mode", configEntry.grant_mode],
                            [
                              "credits",
                              configEntry.credits != null
                                ? String(configEntry.credits)
                                : "-",
                            ],
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                config_json raw
              </p>
              <pre className="mt-3 overflow-x-auto rounded-2xl border border-black/8 bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(product.config_json, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              grant_preview
            </p>
            {product.grant_preview.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500">
                No grant_preview returned.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {product.grant_preview.map((grant, index) => (
                  <div
                    key={`${grant.feature_key}:${index}`}
                    className="rounded-2xl border border-black/8 bg-white px-4 py-4"
                  >
                    <InfoGrid
                      items={[
                        ["feature_key", grant.feature_key],
                        ["grant_mode", grant.grant_mode],
                        [
                          "granted_quantity",
                          grant.granted_quantity != null
                            ? String(grant.granted_quantity)
                            : "null",
                        ],
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </InfoSection>
    </div>
  );
}

function InfoSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-2xl border border-black/8 bg-slate-950/[0.02] px-4 py-4"
        >
          <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {label}
          </dt>
          <dd className="mt-2 break-words text-sm font-medium text-slate-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
