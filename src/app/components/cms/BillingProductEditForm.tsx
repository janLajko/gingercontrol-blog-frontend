"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  PlusCircle,
  RefreshCcw,
  Save,
  Trash2,
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
  BillingGrantMode,
  BillingProductDetail,
  BillingRecurringInterval,
  BillingUpdateProductRequest,
} from "@/types/billing";

interface BillingProductEditFormProps {
  product_code: string;
}

interface BillingProductEditFormState {
  name: string;
  description: string;
  active: boolean;
  sort_order: string;
  config_json: BillingProductConfigFormEntry[];
  price_change_enabled: boolean;
  price_change: {
    currency: "usd";
    unit_amount: string;
    billing_scheme: string;
    type: "recurring" | "one_time";
    recurring_interval: BillingRecurringInterval;
    recurring_interval_count: string;
  };
}

interface BillingProductConfigFormEntry {
  feature_key: string;
  grant_mode: BillingGrantMode;
  credits: string;
}

function createEmptyConfigJsonEntry(): BillingProductConfigFormEntry {
  return {
    feature_key: "",
    grant_mode: "prepaid_quota",
    credits: "",
  };
}

export default function BillingProductEditForm({
  product_code,
}: BillingProductEditFormProps) {
  const router = useRouter();
  const [product, setProduct] = useState<BillingProductDetail | null>(null);
  const [form, setForm] = useState<BillingProductEditFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function loadProduct() {
    try {
      setLoading(true);
      setErrorMessage(null);
      setErrorCode(null);
      const data = await billingAdminApiClient.getProduct(product_code);
      setProduct(data);
      setForm({
        name: data.name,
        description: data.description || "",
        active: data.active,
        sort_order: String(data.sort_order),
        config_json:
          data.config_json.length > 0
            ? data.config_json.map((entry) => ({
                feature_key: entry.feature_key,
                grant_mode: entry.grant_mode,
                credits: entry.credits != null ? String(entry.credits) : "",
              }))
            : [createEmptyConfigJsonEntry()],
        price_change_enabled: false,
        price_change: {
          currency: data.stripe_catalog.currency,
          unit_amount: String(data.stripe_catalog.unit_amount),
          billing_scheme: data.stripe_catalog.billing_scheme || "",
          type: data.product_type === "subscription" ? "recurring" : "one_time",
          recurring_interval:
            data.stripe_catalog.recurring_interval || "month",
          recurring_interval_count:
            data.stripe_catalog.recurring_interval_count != null
              ? String(data.stripe_catalog.recurring_interval_count)
              : "1",
        },
      });
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

  function updateConfigEntry(
    index: number,
    patch: Partial<BillingProductConfigFormEntry>,
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            config_json: current.config_json.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, ...patch } : entry,
            ),
          }
        : current,
    );
  }

  function updateGrantMode(index: number, grant_mode: BillingGrantMode) {
    setForm((current) =>
      current
        ? {
            ...current,
            config_json: current.config_json.map((entry, entryIndex) =>
              entryIndex === index
                ? {
                    ...entry,
                    grant_mode,
                    credits: grant_mode === "unlimited" ? "" : entry.credits,
                  }
                : entry,
            ),
          }
        : current,
    );
  }

  function addConfigJsonEntry() {
    setForm((current) =>
      current
        ? {
            ...current,
            config_json: [...current.config_json, createEmptyConfigJsonEntry()],
          }
        : current,
    );
  }

  function removeConfigJsonEntry(index: number) {
    setForm((current) =>
      current
        ? {
            ...current,
            config_json:
              current.config_json.length === 1
                ? current.config_json
                : current.config_json.filter(
                    (_, entryIndex) => entryIndex !== index,
                  ),
          }
        : current,
    );
  }

  function validateForm() {
    if (!form || !product) {
      return { _form: "Product form is not ready" };
    }

    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = "required";
    }
    if (!form.sort_order.trim()) {
      nextErrors.sort_order = "required";
    } else if (!Number.isFinite(Number(form.sort_order))) {
      nextErrors.sort_order = "must be a number";
    }
    if (form.config_json.length === 0) {
      nextErrors.config_json = "at least one config_json entry is required";
    }
    form.config_json.forEach((entry, index) => {
      if (!entry.feature_key.trim()) {
        nextErrors[`config_json.${index}.feature_key`] = "required";
      }
      if (!entry.grant_mode) {
        nextErrors[`config_json.${index}.grant_mode`] = "required";
      }
      if (entry.grant_mode === "prepaid_quota") {
        const credits = Number(entry.credits);
        if (!entry.credits.trim()) {
          nextErrors[`config_json.${index}.credits`] = "required";
        } else if (!Number.isFinite(credits) || credits <= 0) {
          nextErrors[`config_json.${index}.credits`] = "must be > 0";
        }
      }
    });

    if (form.price_change_enabled) {
      const unitAmount = Number(form.price_change.unit_amount);
      if (!form.price_change.unit_amount.trim()) {
        nextErrors["stripe_sync.price_change.unit_amount"] = "required";
      } else if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        nextErrors["stripe_sync.price_change.unit_amount"] = "must be > 0";
      }

      if (product.product_type === "subscription") {
        const recurringIntervalCount = Number(
          form.price_change.recurring_interval_count,
        );
        if (!form.price_change.recurring_interval_count.trim()) {
          nextErrors["stripe_sync.price_change.recurring_interval_count"] =
            "required";
        } else if (
          !Number.isFinite(recurringIntervalCount) ||
          recurringIntervalCount <= 0
        ) {
          nextErrors["stripe_sync.price_change.recurring_interval_count"] =
            "must be > 0";
        }
      } else if (!form.price_change.billing_scheme.trim()) {
        nextErrors["stripe_sync.price_change.billing_scheme"] = "required";
      }
    }

    return nextErrors;
  }

  function buildPayload(): BillingUpdateProductRequest {
    if (!form || !product) {
      throw new Error("Product form is not ready");
    }

    const stripe_sync =
      form.price_change_enabled === false
        ? {
            update_product: true,
            price_change: {
              enabled: false as const,
            },
          }
        : product.product_type === "subscription"
          ? {
              update_product: true,
              price_change: {
                enabled: true as const,
                currency: "usd" as const,
                unit_amount: Number(form.price_change.unit_amount),
                ...(form.price_change.billing_scheme.trim()
                  ? { billing_scheme: form.price_change.billing_scheme.trim() }
                  : {}),
                type: "recurring" as const,
                recurring_interval: form.price_change.recurring_interval,
                recurring_interval_count: Number(
                  form.price_change.recurring_interval_count,
                ),
              },
            }
          : {
              update_product: true,
              price_change: {
                enabled: true as const,
                currency: "usd" as const,
                unit_amount: Number(form.price_change.unit_amount),
                billing_scheme: form.price_change.billing_scheme.trim(),
                type: "one_time" as const,
              },
            };

    return {
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      active: form.active,
      sort_order: Number(form.sort_order || "0"),
      config_json: form.config_json.map((entry) => ({
        feature_key: entry.feature_key.trim(),
        grant_mode: entry.grant_mode,
        ...(entry.grant_mode === "prepaid_quota"
          ? { credits: Number(entry.credits) }
          : {}),
      })),
      stripe_sync,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !product || submitting) {
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
      const updated = await billingAdminApiClient.replaceProduct(
        product.product_code,
        buildPayload(),
      );
      setProduct(updated);
      setSuccessMessage("Billing Product updated.");
      router.push(
        `/cms/billing/products/${encodeURIComponent(updated.product_code)}`,
      );
    } catch (submitError) {
      const resolved = resolveBillingAdminError(
        submitError,
        "Failed to update billing product",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
      setFieldErrors(resolved.field_errors);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <BillingAdminFeedback
          activity={{
            state: "loading",
            message: "Loading billing product edit form...",
          }}
        />
      </section>
    );
  }

  if (!product || !form) {
    return (
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <BillingAdminFeedback
          errorMessage={errorMessage || "Billing product not found."}
          errorCode={errorCode}
        />
      </section>
    );
  }

  const hasActiveMismatch = product.active !== product.stripe_catalog.active;
  const subscriptionMode = product.product_type === "subscription";

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href={`/cms/billing/products/${encodeURIComponent(product.product_code)}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Billing Product Detail
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Billing Product Edit
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              编辑 {product.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              `product_code`、`product_type`、`product_family` 为只读，价格变化会创建新的
              Stripe Price，只影响新购买。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadProduct()}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? "Saving..." : "Save Changes"}
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
            submitting
              ? {
                  state: "saving",
                  message: "Saving billing product...",
                }
              : null
          }
          successMessage={successMessage}
          errorMessage={errorMessage}
          errorCode={errorCode}
        />
      </section>

      <FormSection
        title="只读字段"
        description="这些字段按文档要求不可编辑。"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <ReadonlyField label="product_code" value={product.product_code} />
          <ReadonlyField label="product_family" value={product.product_family} />
          <ReadonlyField label="product_type" value={product.product_type} />
        </div>
      </FormSection>

      <FormSection
        title="可编辑字段"
        description="name、description、active、sort_order、config_json 可编辑。"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="name" error={fieldErrors.name}>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              maxLength={128}
              className={inputClassName(Boolean(fieldErrors.name))}
            />
          </Field>

          <Field label="description" error={fieldErrors.description}>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? { ...current, description: event.target.value }
                    : current,
                )
              }
              rows={3}
              className={textareaClassName(Boolean(fieldErrors.description))}
            />
          </Field>

          <Field label="active" error={fieldErrors.active}>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, active: event.target.checked } : current,
                  )
                }
                className="h-4 w-4 rounded border-black/20 text-slate-950 focus:ring-slate-950"
              />
              <span className="text-sm font-semibold text-slate-900">
                {String(form.active)}
              </span>
            </label>
          </Field>

          <Field label="sort_order" error={fieldErrors.sort_order}>
            <input
              type="number"
              value={form.sort_order}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? { ...current, sort_order: event.target.value }
                    : current,
                )
              }
              className={inputClassName(Boolean(fieldErrors.sort_order))}
            />
          </Field>

          <div className="lg:col-span-2">
            <div className="rounded-[1.6rem] border border-black/8 bg-slate-950/[0.02] p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    config_json
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    编辑页支持维护多条 config_json；每条对应一条 grant 配置。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addConfigJsonEntry}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add config_json
                </button>
              </div>

              <BillingAdminFieldError error={fieldErrors.config_json} />
              <datalist id="billing-edit-feature-key-options">
                <option value="simulate.run" />
                <option value="classification.run" />
              </datalist>

              <div className="space-y-5">
                {form.config_json.map((entry, index) => {
                  const showCredits = entry.grant_mode === "prepaid_quota";

                  return (
                    <div
                      key={`config_json_${index}`}
                      className="rounded-[1.4rem] border border-black/8 bg-white p-5"
                    >
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                            config_json.{index}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            这里的字段会原样提交到 `config_json` 数组。
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={form.config_json.length === 1}
                          onClick={() => removeConfigJsonEntry(index)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-5 lg:grid-cols-2">
                        <Field
                          label={`config_json.${index}.feature_key`}
                          error={fieldErrors[`config_json.${index}.feature_key`]}
                        >
                          <input
                            value={entry.feature_key}
                            onChange={(event) =>
                              updateConfigEntry(index, {
                                feature_key: event.target.value,
                              })
                            }
                            list="billing-edit-feature-key-options"
                            className={inputClassName(
                              Boolean(
                                fieldErrors[`config_json.${index}.feature_key`],
                              ),
                            )}
                          />
                        </Field>

                        <Field
                          label={`config_json.${index}.grant_mode`}
                          error={fieldErrors[`config_json.${index}.grant_mode`]}
                        >
                          <select
                            value={entry.grant_mode}
                            onChange={(event) =>
                              updateGrantMode(
                                index,
                                event.target.value as BillingGrantMode,
                              )
                            }
                            className={inputClassName(
                              Boolean(
                                fieldErrors[`config_json.${index}.grant_mode`],
                              ),
                            )}
                          >
                            <option value="unlimited">unlimited</option>
                            <option value="prepaid_quota">prepaid_quota</option>
                          </select>
                        </Field>

                        {showCredits ? (
                          <Field
                            label={`config_json.${index}.credits`}
                            error={fieldErrors[`config_json.${index}.credits`]}
                          >
                            <input
                              type="number"
                              min={1}
                              value={entry.credits}
                              onChange={(event) =>
                                updateConfigEntry(index, {
                                  credits: event.target.value,
                                })
                              }
                              className={inputClassName(
                                Boolean(
                                  fieldErrors[`config_json.${index}.credits`],
                                ),
                              )}
                            />
                          </Field>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500">
                            `config_json.{index}.credits` 已隐藏，因为 `grant_mode=unlimited`。
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Stripe 展示信息"
        description="当前 Stripe catalog 信息仅展示，不可编辑。"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <ReadonlyField
            label="stripe_product_id"
            value={product.stripe_catalog.stripe_product_id}
          />
          <ReadonlyField
            label="stripe_price_id"
            value={product.stripe_catalog.stripe_price_id}
          />
          <ReadonlyField
            label="currency"
            value={product.stripe_catalog.currency}
          />
          <ReadonlyField
            label="unit_amount"
            value={String(product.stripe_catalog.unit_amount)}
          />
          <ReadonlyField
            label="billing_scheme"
            value={product.stripe_catalog.billing_scheme}
          />
          <ReadonlyField
            label="recurring_interval"
            value={product.stripe_catalog.recurring_interval || "-"}
          />
          <ReadonlyField
            label="recurring_interval_count"
            value={
              product.stripe_catalog.recurring_interval_count != null
                ? String(product.stripe_catalog.recurring_interval_count)
                : "-"
            }
          />
          <ReadonlyField
            label="lookup_key"
            value={product.stripe_catalog.lookup_key || "-"}
          />
          <ReadonlyField
            label="active"
            value={String(product.stripe_catalog.active)}
          />
        </div>
      </FormSection>

      <FormSection
        title="Stripe 价格变更"
        description="编辑页必须明确区分只改展示信息和改价格。"
      >
        <div className="space-y-6">
          <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white px-4 py-4">
            <input
              type="checkbox"
              checked={form.price_change_enabled}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? { ...current, price_change_enabled: event.target.checked }
                    : current,
                )
              }
              className="mt-1 h-4 w-4 rounded border-black/20 text-slate-950 focus:ring-slate-950"
            />
            <div>
              <p className="font-semibold text-slate-950">
                本次更新包含价格变更
              </p>
              <p className="mt-1 text-sm text-slate-600">
                价格变更会创建新的 Stripe Price，只影响新购买，不影响历史购买记录。
              </p>
            </div>
          </label>

          {form.price_change_enabled ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="stripe_sync.price_change.currency"
                error={fieldErrors["stripe_sync.price_change.currency"]}
              >
                <select
                  value={form.price_change.currency}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            price_change: {
                              ...current.price_change,
                              currency: event.target.value as "usd",
                            },
                          }
                        : current,
                    )
                  }
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price_change.currency"]),
                  )}
                >
                  <option value="usd">usd</option>
                </select>
              </Field>

              <Field
                label="stripe_sync.price_change.unit_amount"
                error={fieldErrors["stripe_sync.price_change.unit_amount"]}
              >
                <input
                  type="number"
                  min={1}
                  value={form.price_change.unit_amount}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            price_change: {
                              ...current.price_change,
                              unit_amount: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price_change.unit_amount"]),
                  )}
                />
              </Field>

              <Field
                label="stripe_sync.price_change.billing_scheme"
                error={fieldErrors["stripe_sync.price_change.billing_scheme"]}
              >
                <input
                  value={form.price_change.billing_scheme}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            price_change: {
                              ...current.price_change,
                              billing_scheme: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  placeholder="per_unit"
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price_change.billing_scheme"]),
                  )}
                />
              </Field>

              <ReadonlyField
                label="stripe_sync.price_change.type"
                value={subscriptionMode ? "recurring" : "one_time"}
              />

              {subscriptionMode ? (
                <>
                  <Field
                    label="stripe_sync.price_change.recurring_interval"
                    error={fieldErrors["stripe_sync.price_change.recurring_interval"]}
                  >
                    <select
                      value={form.price_change.recurring_interval}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                price_change: {
                                  ...current.price_change,
                                  recurring_interval:
                                    event.target.value as BillingRecurringInterval,
                                },
                              }
                            : current,
                        )
                      }
                      className={inputClassName(
                        Boolean(
                          fieldErrors["stripe_sync.price_change.recurring_interval"],
                        ),
                      )}
                    >
                      <option value="month">month</option>
                      <option value="year">year</option>
                      <option value="week">week</option>
                      <option value="day">day</option>
                    </select>
                  </Field>

                  <Field
                    label="stripe_sync.price_change.recurring_interval_count"
                    error={
                      fieldErrors["stripe_sync.price_change.recurring_interval_count"]
                    }
                  >
                    <input
                      type="number"
                      min={1}
                      value={form.price_change.recurring_interval_count}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                price_change: {
                                  ...current.price_change,
                                  recurring_interval_count: event.target.value,
                                },
                              }
                            : current,
                        )
                      }
                      className={inputClassName(
                        Boolean(
                          fieldErrors[
                            "stripe_sync.price_change.recurring_interval_count"
                          ],
                        ),
                      )}
                    />
                  </Field>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500 lg:col-span-2">
                  `recurring_interval` 和 `recurring_interval_count`
                  已隐藏，因为当前 `product_type=credit_pack`。
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-slate-500">
              当前只会更新 Stripe Product 展示信息，不会创建新的 Stripe Price。
            </div>
          )}
        </div>
      </FormSection>
    </form>
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

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <div className="rounded-2xl border border-black/8 bg-slate-950/[0.03] px-4 py-3 text-sm font-medium text-slate-900">
        {value}
      </div>
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
