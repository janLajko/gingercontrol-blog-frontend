"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LoaderCircle,
  PlusCircle,
  RefreshCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  BillingAdminFeedback,
  BillingAdminFieldError,
} from "@/app/components/cms/BillingAdminFeedback";
import { billingAdminApiClient } from "@/app/lib/billing-admin-api";
import {
  hasBillingAdminFieldErrors,
  resolveBillingAdminError,
} from "@/app/lib/billing-admin-feedback";
import type {
  BillingFeaturePolicy,
  BillingGrantMode,
  BillingProduct,
  BillingPurchaseSnapshot,
  BillingUserBillingSummaryResponse,
  BillingUserOption,
} from "@/types/billing";

interface GrantFormEntry {
  feature_key: string;
  grant_mode: BillingGrantMode;
  quantity: string;
  starts_at: string;
  ends_at: string;
}

interface ManualBillingFormState {
  product_code: string;
  purchase_starts_at: string;
  purchase_ends_at: string;
  reason: string;
  contract_no: string;
  note: string;
  grants: GrantFormEntry[];
}

const DEFAULT_FORM: ManualBillingFormState = {
  product_code: "",
  purchase_starts_at: "",
  purchase_ends_at: "",
  reason: "",
  contract_no: "",
  note: "",
  grants: [createEmptyGrantEntry()],
};

function createEmptyGrantEntry(patch: Partial<GrantFormEntry> = {}): GrantFormEntry {
  return {
    feature_key: "",
    grant_mode: "prepaid_quota",
    quantity: "",
    starts_at: "",
    ends_at: "",
    ...patch,
  };
}

export default function BillingUserBillingConsole() {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [featurePolicies, setFeaturePolicies] = useState<BillingFeaturePolicy[]>([]);
  const [loadingBaseData, setLoadingBaseData] = useState(true);

  const [userKeyword, setUserKeyword] = useState("");
  const [userOptions, setUserOptions] = useState<BillingUserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [summary, setSummary] = useState<BillingUserBillingSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [form, setForm] = useState<ManualBillingFormState>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingPurchaseId, setCancelingPurchaseId] = useState<number | null>(null);

  useEffect(() => {
    async function loadBaseData() {
      try {
        setLoadingBaseData(true);
        const [productsResponse, policiesResponse] = await Promise.all([
          billingAdminApiClient.listProducts({ page: 1, page_size: 100, active: true }),
          billingAdminApiClient.listFeaturePolicies(),
        ]);
        setProducts(productsResponse.items);
        setFeaturePolicies(policiesResponse.items.filter((item) => item.active));
      } catch (loadError) {
        const resolved = resolveBillingAdminError(
          loadError,
          "Failed to load user billing base data",
        );
        setErrorMessage(resolved.message);
        setErrorCode(resolved.code || null);
      } finally {
        setLoadingBaseData(false);
      }
    }

    void loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedUserId == null) {
      setSummary(null);
      return;
    }
    const userId = selectedUserId;

    async function loadSummary() {
      try {
        setSummaryLoading(true);
        const response = await billingAdminApiClient.getUserBillingSummary(userId);
        setSummary(response);
      } catch (loadError) {
        const resolved = resolveBillingAdminError(
          loadError,
          "Failed to load user billing summary",
        );
        setErrorMessage(resolved.message);
        setErrorCode(resolved.code || null);
      } finally {
        setSummaryLoading(false);
      }
    }

    void loadSummary();
  }, [selectedUserId]);

  async function handleUserSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    try {
      setSearchingUsers(true);
      const response = await billingAdminApiClient.searchUsers(userKeyword.trim(), 20);
      setUserOptions(response.items);
    } catch (searchError) {
      const resolved = resolveBillingAdminError(
        searchError,
        "Failed to search users",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
    } finally {
      setSearchingUsers(false);
    }
  }

  function syncGrantDateDefaults(
    patch: Partial<Pick<ManualBillingFormState, "purchase_starts_at" | "purchase_ends_at">>,
  ) {
    setForm((current) => ({
      ...current,
      ...patch,
      grants: current.grants.map((grant) => ({
        ...grant,
        starts_at:
          patch.purchase_starts_at !== undefined && !grant.starts_at
            ? patch.purchase_starts_at
            : grant.starts_at,
        ends_at:
          patch.purchase_ends_at !== undefined && !grant.ends_at
            ? patch.purchase_ends_at
            : grant.ends_at,
      })),
    }));
  }

  function seedGrantsFromProduct(productCode: string) {
    const product = products.find((item) => item.product_code === productCode);
    const seeded =
      product && product.config_json.length > 0
        ? product.config_json.map((entry) =>
            createEmptyGrantEntry({
              feature_key: entry.feature_key,
              grant_mode: entry.grant_mode,
              quantity: entry.credits != null ? String(entry.credits) : "",
              starts_at: form.purchase_starts_at,
              ends_at: form.purchase_ends_at,
            }),
          )
        : [
            createEmptyGrantEntry({
              starts_at: form.purchase_starts_at,
              ends_at: form.purchase_ends_at,
            }),
          ];

    setForm((current) => ({
      ...current,
      product_code: productCode,
      grants: seeded,
    }));
  }

  function updateGrant(index: number, patch: Partial<GrantFormEntry>) {
    setForm((current) => ({
      ...current,
      grants: current.grants.map((grant, grantIndex) =>
        grantIndex === index ? { ...grant, ...patch } : grant,
      ),
    }));
  }

  function updateGrantMode(index: number, grant_mode: BillingGrantMode) {
    updateGrant(index, {
      grant_mode,
      quantity: grant_mode === "unlimited" ? "" : form.grants[index]?.quantity ?? "",
    });
  }

  function addGrant() {
    setForm((current) => ({
      ...current,
      grants: [
        ...current.grants,
        createEmptyGrantEntry({
          starts_at: current.purchase_starts_at,
          ends_at: current.purchase_ends_at,
        }),
      ],
    }));
  }

  function removeGrant(index: number) {
    setForm((current) => ({
      ...current,
      grants:
        current.grants.length === 1
          ? current.grants
          : current.grants.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (selectedUserId == null) {
      nextErrors.user_id = "required";
    }
    if (!form.product_code) {
      nextErrors.product_code = "required";
    }
    if (
      form.purchase_starts_at &&
      form.purchase_ends_at &&
      form.purchase_ends_at <= form.purchase_starts_at
    ) {
      nextErrors.purchase_ends_at = "must be after purchase_starts_at";
    }
    if (form.grants.length === 0) {
      nextErrors.grants = "at least one grant is required";
    }

    form.grants.forEach((grant, index) => {
      if (!grant.feature_key) {
        nextErrors[`grants.${index}.feature_key`] = "required";
      }
      if (grant.grant_mode === "prepaid_quota") {
        if (!grant.quantity.trim()) {
          nextErrors[`grants.${index}.quantity`] = "required";
        } else if (!Number.isFinite(Number(grant.quantity)) || Number(grant.quantity) <= 0) {
          nextErrors[`grants.${index}.quantity`] = "must be > 0";
        }
      }
      if (grant.grant_mode === "unlimited" && grant.quantity.trim()) {
        nextErrors[`grants.${index}.quantity`] = "must be empty for unlimited";
      }
      if (grant.starts_at && grant.ends_at && grant.ends_at <= grant.starts_at) {
        nextErrors[`grants.${index}.ends_at`] = "must be after starts_at";
      }
      if (
        form.purchase_starts_at &&
        grant.starts_at &&
        grant.starts_at < form.purchase_starts_at
      ) {
        nextErrors[`grants.${index}.starts_at`] = "must be within purchase window";
      }
      if (
        form.purchase_ends_at &&
        grant.ends_at &&
        grant.ends_at > form.purchase_ends_at
      ) {
        nextErrors[`grants.${index}.ends_at`] = "must be within purchase window";
      }
    });

    return nextErrors;
  }

  async function handleCreateManualPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedUserId == null || submitting) {
      return;
    }

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    setErrorMessage(null);
    setErrorCode(null);
    setSuccessMessage(null);

    if (hasBillingAdminFieldErrors(nextErrors)) {
      setErrorMessage("请先修正表单校验错误。");
      return;
    }

    try {
      setSubmitting(true);
      await billingAdminApiClient.createManualPurchase(selectedUserId, {
        product_code: form.product_code,
        ...(form.purchase_starts_at
          ? { purchase_starts_at: toIsoString(form.purchase_starts_at) }
          : {}),
        ...(form.purchase_ends_at
          ? { purchase_ends_at: toIsoString(form.purchase_ends_at) }
          : {}),
        ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
        ...(form.contract_no.trim() ? { contract_no: form.contract_no.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
        grants: form.grants.map((grant) => ({
          feature_key: grant.feature_key,
          grant_mode: grant.grant_mode,
          ...(grant.grant_mode === "prepaid_quota"
            ? { quantity: Number(grant.quantity) }
            : {}),
          ...(grant.starts_at ? { starts_at: toIsoString(grant.starts_at) } : {}),
          ...(grant.ends_at ? { ends_at: toIsoString(grant.ends_at) } : {}),
        })),
      });

      setSuccessMessage("Manual billing created.");
      setForm(DEFAULT_FORM);
      const refreshed = await billingAdminApiClient.getUserBillingSummary(selectedUserId);
      setSummary(refreshed);
    } catch (submitError) {
      const resolved = resolveBillingAdminError(
        submitError,
        "Failed to create manual billing",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
      setFieldErrors(resolved.field_errors);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelPurchase(purchase: BillingPurchaseSnapshot) {
    const confirmed = window.confirm(
      `确认取消手工发放记录 ${purchase.purchase_id} (${purchase.product_code}) 吗？`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setCancelingPurchaseId(purchase.purchase_id);
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);
      await billingAdminApiClient.cancelManualPurchase(purchase.purchase_id, {});
      setSuccessMessage(`Purchase ${purchase.purchase_id} canceled.`);
      if (selectedUserId != null) {
        const refreshed = await billingAdminApiClient.getUserBillingSummary(selectedUserId);
        setSummary(refreshed);
      }
    } catch (cancelError) {
      const resolved = resolveBillingAdminError(
        cancelError,
        "Failed to cancel manual purchase",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
    } finally {
      setCancelingPurchaseId(null);
    }
  }

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
              Back to Billing
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Manage User Billing
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              后台发放用户 Billing 权限
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              适用于合同用户。后台创建 manual purchase，并同时生成 entitlement grants。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (selectedUserId != null) {
                void billingAdminApiClient
                  .getUserBillingSummary(selectedUserId)
                  .then(setSummary)
                  .catch((error) => {
                    const resolved = resolveBillingAdminError(
                      error,
                      "Failed to refresh user billing summary",
                    );
                    setErrorMessage(resolved.message);
                    setErrorCode(resolved.code || null);
                  });
              }
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <BillingAdminFeedback
          className="mt-6"
          activity={
            submitting
              ? { state: "saving", message: "Creating manual billing..." }
              : summaryLoading
                ? { state: "loading", message: "Loading user billing summary..." }
                : searchingUsers
                  ? { state: "loading", message: "Searching users..." }
                  : null
          }
          successMessage={successMessage}
          errorMessage={errorMessage}
          errorCode={errorCode}
        />
      </section>

      <FormSection
        title="User Search"
        description="从 users 表按邮箱搜索，选中后基于 user_id 管理账务。"
      >
        <form className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_160px]" onSubmit={handleUserSearch}>
          <Field label="email keyword" error={fieldErrors.user_id}>
            <input
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
              placeholder="user@example.com"
              className={inputClassName(Boolean(fieldErrors.user_id))}
            />
          </Field>
          <button
            type="submit"
            disabled={searchingUsers || !userKeyword.trim()}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searchingUsers ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </form>

        <div className="mt-5">
          <Field label="user" error={fieldErrors.user_id}>
            <select
              value={selectedUserId != null ? String(selectedUserId) : ""}
              onChange={(event) =>
                setSelectedUserId(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className={inputClassName(Boolean(fieldErrors.user_id))}
            >
              <option value="">Select user</option>
              {userOptions.map((item) => (
                <option key={item.user_id} value={item.user_id}>
                  {item.email}
                  {item.name ? ` · ${item.name}` : ""}
                  {item.company_name ? ` · ${item.company_name}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </FormSection>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <FormSection
          title="Current Summary"
          description="当前用户的有效余额、历史 purchase 和最近 usage。"
        >
          {!summary ? (
            <EmptyState message="Select a user to inspect billing." />
          ) : (
            <div className="space-y-6">
              <InfoGrid
                items={[
                  ["user_id", String(summary.user.user_id)],
                  ["email", summary.user.email],
                  ["name", summary.user.name || "-"],
                  ["company_name", summary.user.company_name || "-"],
                ]}
              />

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Balances
                </p>
                {summary.balances.length === 0 ? (
                  <EmptyState message="No effective balances." className="mt-3" />
                ) : (
                  <div className="mt-3 space-y-3">
                    {summary.balances.map((balance) => (
                      <div
                        key={balance.feature_key}
                        className="rounded-2xl border border-black/8 bg-white px-4 py-4"
                      >
                        <InfoGrid
                          items={[
                            ["feature_key", balance.feature_key],
                            ["active_unlimited", String(balance.active_unlimited)],
                            ["total_granted", String(balance.total_granted)],
                            ["total_remaining", String(balance.total_remaining)],
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Recent Usage
                </p>
                {summary.recent_usage.length === 0 ? (
                  <EmptyState message="No usage events." className="mt-3" />
                ) : (
                  <div className="mt-3 space-y-3">
                    {summary.recent_usage.map((usage) => (
                      <div
                        key={usage.usage_event_id}
                        className="rounded-2xl border border-black/8 bg-white px-4 py-4"
                      >
                        <InfoGrid
                          items={[
                            ["usage_event_id", String(usage.usage_event_id)],
                            ["feature_key", usage.feature_key],
                            ["quantity", String(usage.quantity)],
                            ["usage_status", usage.usage_status],
                            ["created_at", formatDateTime(usage.created_at)],
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </FormSection>

        <form onSubmit={handleCreateManualPurchase}>
          <FormSection
            title="Create Manual Billing"
            description="默认带出 product.config_json，同时允许自由添加 grants、数量与时间。"
          >
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="product_code" error={fieldErrors.product_code}>
                  <select
                    value={form.product_code}
                    onChange={(event) => seedGrantsFromProduct(event.target.value)}
                    disabled={loadingBaseData}
                    className={inputClassName(Boolean(fieldErrors.product_code))}
                  >
                    <option value="">
                      {loadingBaseData ? "Loading products..." : "Select product"}
                    </option>
                    {products.map((product) => (
                      <option key={product.product_code} value={product.product_code}>
                        {product.product_code} · {product.product_family}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="reason" error={fieldErrors.reason}>
                  <input
                    value={form.reason}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, reason: event.target.value }))
                    }
                    className={inputClassName(Boolean(fieldErrors.reason))}
                  />
                </Field>

                <Field label="purchase_starts_at" error={fieldErrors.purchase_starts_at}>
                  <input
                    type="datetime-local"
                    value={form.purchase_starts_at}
                    onChange={(event) =>
                      syncGrantDateDefaults({
                        purchase_starts_at: event.target.value,
                      })
                    }
                    className={inputClassName(Boolean(fieldErrors.purchase_starts_at))}
                  />
                </Field>

                <Field label="purchase_ends_at" error={fieldErrors.purchase_ends_at}>
                  <input
                    type="datetime-local"
                    value={form.purchase_ends_at}
                    onChange={(event) =>
                      syncGrantDateDefaults({
                        purchase_ends_at: event.target.value,
                      })
                    }
                    className={inputClassName(Boolean(fieldErrors.purchase_ends_at))}
                  />
                </Field>

                <Field label="contract_no" error={fieldErrors.contract_no}>
                  <input
                    value={form.contract_no}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contract_no: event.target.value,
                      }))
                    }
                    className={inputClassName(Boolean(fieldErrors.contract_no))}
                  />
                </Field>

                <Field label="note" error={fieldErrors.note}>
                  <textarea
                    value={form.note}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, note: event.target.value }))
                    }
                    rows={3}
                    className={textareaClassName(Boolean(fieldErrors.note))}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    grants
                  </p>
                  <BillingAdminFieldError error={fieldErrors.grants} />
                </div>
                <button
                  type="button"
                  onClick={addGrant}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add grant
                </button>
              </div>

              {form.grants.map((grant, index) => {
                const showQuantity = grant.grant_mode === "prepaid_quota";
                return (
                  <div
                    key={`grant-${index}`}
                    className="rounded-[1.6rem] border border-black/8 bg-slate-950/[0.02] p-5"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          grant.{index}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          手工指定 feature、数量和生效时间。
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={form.grants.length === 1}
                        onClick={() => removeGrant(index)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <Field
                        label={`grants.${index}.feature_key`}
                        error={fieldErrors[`grants.${index}.feature_key`]}
                      >
                        <select
                          value={grant.feature_key}
                          onChange={(event) =>
                            updateGrant(index, { feature_key: event.target.value })
                          }
                          className={inputClassName(
                            Boolean(fieldErrors[`grants.${index}.feature_key`]),
                          )}
                        >
                          <option value="">Select feature_key</option>
                          {featurePolicies.map((policy) => (
                            <option key={policy.feature_key} value={policy.feature_key}>
                              {policy.name
                                ? `${policy.feature_key} · ${policy.name}`
                                : policy.feature_key}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label={`grants.${index}.grant_mode`}
                        error={fieldErrors[`grants.${index}.grant_mode`]}
                      >
                        <select
                          value={grant.grant_mode}
                          onChange={(event) =>
                            updateGrantMode(
                              index,
                              event.target.value as BillingGrantMode,
                            )
                          }
                          className={inputClassName(
                            Boolean(fieldErrors[`grants.${index}.grant_mode`]),
                          )}
                        >
                          <option value="prepaid_quota">prepaid_quota</option>
                          <option value="unlimited">unlimited</option>
                        </select>
                      </Field>

                      {showQuantity ? (
                        <Field
                          label={`grants.${index}.quantity`}
                          error={fieldErrors[`grants.${index}.quantity`]}
                        >
                          <input
                            type="number"
                            min={1}
                            value={grant.quantity}
                            onChange={(event) =>
                              updateGrant(index, { quantity: event.target.value })
                            }
                            className={inputClassName(
                              Boolean(fieldErrors[`grants.${index}.quantity`]),
                            )}
                          />
                        </Field>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500">
                          quantity hidden when grant_mode=unlimited.
                        </div>
                      )}

                      <Field
                        label={`grants.${index}.starts_at`}
                        error={fieldErrors[`grants.${index}.starts_at`]}
                      >
                        <input
                          type="datetime-local"
                          value={grant.starts_at}
                          onChange={(event) =>
                            updateGrant(index, { starts_at: event.target.value })
                          }
                          className={inputClassName(
                            Boolean(fieldErrors[`grants.${index}.starts_at`]),
                          )}
                        />
                      </Field>

                      <Field
                        label={`grants.${index}.ends_at`}
                        error={fieldErrors[`grants.${index}.ends_at`]}
                      >
                        <input
                          type="datetime-local"
                          value={grant.ends_at}
                          onChange={(event) =>
                            updateGrant(index, { ends_at: event.target.value })
                          }
                          className={inputClassName(
                            Boolean(fieldErrors[`grants.${index}.ends_at`]),
                          )}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}

              <button
                type="submit"
                disabled={submitting || selectedUserId == null}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                {submitting ? "Creating..." : "Create Manual Billing"}
              </button>
            </div>
          </FormSection>
        </form>
      </section>

      <FormSection
        title="Purchase History"
        description="当前用户的 purchase 历史。admin_manual 记录支持取消。"
      >
        {!summary ? (
          <EmptyState message="Select a user to inspect purchase history." />
        ) : summary.purchases.length === 0 ? (
          <EmptyState message="No purchases found." />
        ) : (
          <div className="space-y-4">
            {summary.purchases.map((purchase) => (
              <div
                key={purchase.purchase_id}
                className="rounded-[1.6rem] border border-black/8 bg-slate-950/[0.02] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <InfoGrid
                    items={[
                      ["purchase_id", String(purchase.purchase_id)],
                      ["product_code", purchase.product_code],
                      ["product_family", purchase.product_family],
                      ["status", purchase.status],
                      ["source", purchase.source || "-"],
                      ["purchased_at", formatDateTime(purchase.purchased_at)],
                    ]}
                  />
                  {purchase.source === "admin_manual" &&
                  purchase.status !== "canceled" ? (
                    <button
                      type="button"
                      disabled={cancelingPurchaseId === purchase.purchase_id}
                      onClick={() => void handleCancelPurchase(purchase)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      {cancelingPurchaseId === purchase.purchase_id
                        ? "Canceling..."
                        : "Cancel"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <InfoGrid
                    items={[
                      ["starts_at", purchase.starts_at ? formatDateTime(purchase.starts_at) : "-"],
                      ["ends_at", purchase.ends_at ? formatDateTime(purchase.ends_at) : "-"],
                      ["reason", purchase.reason || "-"],
                      ["contract_no", purchase.contract_no || "-"],
                    ]}
                  />
                  <InfoGrid items={[["note", purchase.note || "-"]]} />
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    grants
                  </p>
                  <div className="mt-3 space-y-3">
                    {purchase.grants.map((grant) => (
                      <div
                        key={grant.grant_id}
                        className="rounded-2xl border border-black/8 bg-white px-4 py-4"
                      >
                        <InfoGrid
                          items={[
                            ["grant_id", String(grant.grant_id)],
                            ["feature_key", grant.feature_key],
                            ["grant_mode", grant.grant_mode],
                            [
                              "granted_quantity",
                              grant.granted_quantity != null
                                ? String(grant.granted_quantity)
                                : "-",
                            ],
                            [
                              "remaining_quantity",
                              grant.remaining_quantity != null
                                ? String(grant.remaining_quantity)
                                : "-",
                            ],
                            ["status", grant.status],
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </FormSection>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      {children}
      <BillingAdminFieldError error={error} />
    </label>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={`${label}-${value}`}
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

function EmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500 ${className ?? ""}`}
    >
      {message}
    </div>
  );
}

function inputClassName(hasError: boolean) {
  return hasError
    ? "w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-red-500"
    : "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950";
}

function textareaClassName(hasError: boolean) {
  return hasError
    ? "w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-red-500"
    : "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950";
}

function toIsoString(value: string) {
  return new Date(value).toISOString();
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
