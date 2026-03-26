"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  PlusCircle,
  RefreshCcw,
  Search,
} from "lucide-react";

import { BillingAdminFeedback } from "@/app/components/cms/BillingAdminFeedback";
import { billingAdminApiClient } from "@/app/lib/billing-admin-api";
import { resolveBillingAdminError } from "@/app/lib/billing-admin-feedback";
import type {
  BillingProduct,
  BillingProductFamily,
  BillingProductListQuery,
} from "@/types/billing";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

interface FiltersState {
  product_family: BillingProductFamily | "";
  active: "all" | "true" | "false";
  keyword: string;
}

const DEFAULT_FILTERS: FiltersState = {
  product_family: "",
  active: "all",
  keyword: "",
};

export default function BillingProductsTable() {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  async function loadProducts(nextPage = page, nextPageSize = pageSize) {
    try {
      setLoading(true);
      setErrorMessage(null);
      setErrorCode(null);

      const query: BillingProductListQuery = {
        page: nextPage,
        page_size: nextPageSize,
      };

      if (appliedFilters.product_family) {
        query.product_family = appliedFilters.product_family;
      }

      if (appliedFilters.active === "true") {
        query.active = true;
      } else if (appliedFilters.active === "false") {
        query.active = false;
      }

      if (appliedFilters.keyword.trim()) {
        query.keyword = appliedFilters.keyword.trim();
      }

      const data = await billingAdminApiClient.listProducts(query);
      setProducts(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
    } catch (loadError) {
      const resolved = resolveBillingAdminError(
        loadError,
        "Failed to load billing products",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts(page, pageSize);
  }, [page, pageSize, appliedFilters]);

  async function handleToggleActive(product: BillingProduct) {
    const nextActive = !product.active;
    const currentActionKey = `toggle:${product.product_code}`;
    const confirmed = window.confirm(
      nextActive
        ? `确认重新启用 ${product.product_code} 吗？`
        : `确认下线 ${product.product_code} 吗？`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionKey(currentActionKey);
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);

      await billingAdminApiClient.patchProduct(product.product_code, {
        active: nextActive,
      });

      setSuccessMessage(
        nextActive
          ? `${product.product_code} 已上线`
          : `${product.product_code} 已下线`,
      );
      await loadProducts(page, pageSize);
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

  async function handleSyncStripe(product: BillingProduct) {
    const currentActionKey = `sync:${product.product_code}`;

    try {
      setActionKey(currentActionKey);
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);

      await billingAdminApiClient.syncStripe(product.product_code, {
        sync_product: true,
        sync_price: true,
      });

      setSuccessMessage(`${product.product_code} 已触发手动同步 Stripe`);
      await loadProducts(page, pageSize);
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

  function handleApplyFilters() {
    setSuccessMessage(null);
    setPage(1);
    setAppliedFilters({
      product_family: filters.product_family,
      active: filters.active,
      keyword: filters.keyword.trim(),
    });
  }

  function handleResetFilters() {
    setSuccessMessage(null);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-black/8 px-6 py-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Billing Product 列表
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              管理 billing product catalog，并通过后台接口执行筛选、上下线和 Stripe 同步。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadProducts(page, pageSize)}
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              href="/cms/billing/products/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <PlusCircle className="h-4 w-4" />
              New Product
            </Link>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_180px_minmax(220px,1fr)_140px_auto]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              product_family
            </span>
            <select
              value={filters.product_family}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  product_family: event.target.value as BillingProductFamily | "",
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="">All</option>
              <option value="simulate">simulate</option>
              <option value="classification">classification</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              active
            </span>
            <select
              value={filters.active}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  active: event.target.value as FiltersState["active"],
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="all">All</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              keyword
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.keyword}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                placeholder="product_code / name"
                className="w-full rounded-2xl border border-black/10 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-slate-950"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              page_size
            </span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              Reset
            </button>
          </div>
        </div>

        <BillingAdminFeedback
          activity={
            loading
              ? {
                  state: "loading",
                  message: "Loading billing products...",
                }
              : actionKey?.startsWith("sync:")
                ? {
                    state: "syncing",
                    message: "Syncing Stripe catalog...",
                  }
                : actionKey?.startsWith("toggle:")
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
      </div>

      {loading ? (
        <div className="px-6 py-8 text-sm text-slate-500">
          Loading billing products...
        </div>
      ) : products.length === 0 ? (
        <div className="px-6 py-10 text-sm text-slate-600">
          No billing products found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-950/[0.03] text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">product_code</th>
                  <th className="px-6 py-4 font-semibold">product_family</th>
                  <th className="px-6 py-4 font-semibold">name</th>
                  <th className="px-6 py-4 font-semibold">product_type</th>
                  <th className="px-6 py-4 font-semibold">active</th>
                  <th className="px-6 py-4 font-semibold">stripe_product_id</th>
                  <th className="px-6 py-4 font-semibold">stripe_price_id</th>
                  <th className="px-6 py-4 font-semibold">sort_order</th>
                  <th className="px-6 py-4 font-semibold">updated_at</th>
                  <th className="px-6 py-4 font-semibold">actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {products.map((product) => {
                  const toggleKey = `toggle:${product.product_code}`;
                  const syncKey = `sync:${product.product_code}`;
                  const busy = actionKey === toggleKey || actionKey === syncKey;

                  return (
                    <tr
                      key={product.product_code}
                      className="align-top transition hover:bg-black/[0.02]"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-slate-950">
                        {product.product_code}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {product.product_family}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {product.name}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {product.product_type}
                      </td>
                      <td className="px-6 py-5 text-sm">
                        <span
                          className={
                            product.active
                              ? "rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700"
                              : "rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-700"
                          }
                        >
                          {String(product.active)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {product.stripe_product_id}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {product.stripe_price_id}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {product.sort_order}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {formatDate(product.updated_at)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/cms/billing/products/${encodeURIComponent(product.product_code)}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            查看详情
                          </Link>
                          <Link
                            href={`/cms/billing/products/${encodeURIComponent(product.product_code)}/edit`}
                            className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            编辑
                          </Link>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleActive(product)}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionKey === toggleKey
                              ? "处理中..."
                              : product.active
                                ? "下线"
                                : "上线"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSyncStripe(product)}
                            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            {actionKey === syncKey ? "同步中..." : "手动同步 Stripe"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/8 px-6 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Page {page} of {totalPages}. {total} products total.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
