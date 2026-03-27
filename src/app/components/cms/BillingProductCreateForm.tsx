"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, PlusCircle, Trash2 } from "lucide-react";

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
  BillingCreateProductRequest,
  BillingFeaturePolicy,
  BillingGrantMode,
  BillingProductFamily,
  BillingProductType,
  BillingRecurringInterval,
  BillingStripeSyncMode,
} from "@/types/billing";

interface BillingProductCreateFormState {
  product_code: string;
  product_family: BillingProductFamily;
  name: string;
  description: string;
  product_type: BillingProductType;
  active: boolean;
  sort_order: string;
  config_json: BillingProductConfigFormEntry[];
  stripe_sync: {
    mode: BillingStripeSyncMode;
    price: {
      currency: "usd";
      unit_amount: string;
      billing_scheme: string;
      type: "recurring" | "one_time";
      recurring_interval: BillingRecurringInterval;
      recurring_interval_count: string;
      lookup_key: string;
    };
    stripe_product_id: string;
    stripe_price_id: string;
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

const defaultFormState: BillingProductCreateFormState = {
  product_code: "",
  product_family: "classification",
  name: "",
  description: "",
  product_type: "credit_pack",
  active: true,
  sort_order: "0",
  config_json: [createEmptyConfigJsonEntry()],
  stripe_sync: {
    mode: "create",
    price: {
      currency: "usd",
      unit_amount: "",
      billing_scheme: "",
      type: "one_time",
      recurring_interval: "month",
      recurring_interval_count: "1",
      lookup_key: "",
    },
    stripe_product_id: "",
    stripe_price_id: "",
  },
};

export default function BillingProductCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState<BillingProductCreateFormState>(defaultFormState);
  const [featurePolicies, setFeaturePolicies] = useState<BillingFeaturePolicy[]>([]);
  const [featurePoliciesLoading, setFeaturePoliciesLoading] = useState(true);
  const [featurePoliciesError, setFeaturePoliciesError] = useState<string | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadFeaturePolicies() {
      try {
        setFeaturePoliciesLoading(true);
        setFeaturePoliciesError(null);
        const response = await billingAdminApiClient.listFeaturePolicies();
        setFeaturePolicies(response.items);
      } catch (loadError) {
        const resolved = resolveBillingAdminError(
          loadError,
          "Failed to load feature_key options",
        );
        setFeaturePoliciesError(resolved.message);
      } finally {
        setFeaturePoliciesLoading(false);
      }
    }

    void loadFeaturePolicies();
  }, []);

  function updateProductType(product_type: BillingProductType) {
    setForm((current) => ({
      ...current,
      product_type,
      stripe_sync: {
        ...current.stripe_sync,
        price: {
          ...current.stripe_sync.price,
          type: product_type === "subscription" ? "recurring" : "one_time",
        },
      },
    }));
  }

  function updateConfigEntry(
    index: number,
    patch: Partial<BillingProductConfigFormEntry>,
  ) {
    setForm((current) => ({
      ...current,
      config_json: current.config_json.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function updateGrantMode(index: number, grant_mode: BillingGrantMode) {
    setForm((current) => ({
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
    }));
  }

  function addConfigJsonEntry() {
    setForm((current) => ({
      ...current,
      config_json: [...current.config_json, createEmptyConfigJsonEntry()],
    }));
  }

  function removeConfigJsonEntry(index: number) {
    setForm((current) => ({
      ...current,
      config_json:
        current.config_json.length === 1
          ? current.config_json
          : current.config_json.filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  function updateStripeSyncMode(mode: BillingStripeSyncMode) {
    setForm((current) => ({
      ...current,
      stripe_sync: {
        ...current.stripe_sync,
        mode,
      },
    }));
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (!form.product_code.trim()) {
      nextErrors.product_code = "required";
    }
    if (!form.product_family) {
      nextErrors.product_family = "required";
    }
    if (!form.name.trim()) {
      nextErrors.name = "required";
    }
    if (!form.product_type) {
      nextErrors.product_type = "required";
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

    if (!form.sort_order.trim()) {
      nextErrors.sort_order = "required";
    } else if (!Number.isFinite(Number(form.sort_order))) {
      nextErrors.sort_order = "must be a number";
    }

    if (form.stripe_sync.mode === "create") {
      const unitAmount = Number(form.stripe_sync.price.unit_amount);
      if (!form.stripe_sync.price.unit_amount.trim()) {
        nextErrors["stripe_sync.price.unit_amount"] = "required";
      } else if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        nextErrors["stripe_sync.price.unit_amount"] = "must be > 0";
      }

      if (form.product_type === "subscription") {
        if (!form.stripe_sync.price.recurring_interval) {
          nextErrors["stripe_sync.price.recurring_interval"] = "required";
        }

        const recurringIntervalCount = Number(
          form.stripe_sync.price.recurring_interval_count,
        );
        if (!form.stripe_sync.price.recurring_interval_count.trim()) {
          nextErrors["stripe_sync.price.recurring_interval_count"] = "required";
        } else if (
          !Number.isFinite(recurringIntervalCount) ||
          recurringIntervalCount <= 0
        ) {
          nextErrors["stripe_sync.price.recurring_interval_count"] =
            "must be > 0";
        }
      }

      if (
        form.product_type === "credit_pack" &&
        !form.stripe_sync.price.billing_scheme.trim()
      ) {
        nextErrors["stripe_sync.price.billing_scheme"] = "required";
      }
    }

    if (form.stripe_sync.mode === "bind_existing") {
      if (!form.stripe_sync.stripe_product_id.trim()) {
        nextErrors["stripe_sync.stripe_product_id"] = "required";
      }
      if (!form.stripe_sync.stripe_price_id.trim()) {
        nextErrors["stripe_sync.stripe_price_id"] = "required";
      }
    }

    return nextErrors;
  }

  function buildPayload(): BillingCreateProductRequest {
    const stripe_sync =
      form.stripe_sync.mode === "create"
        ? form.product_type === "subscription"
          ? {
              mode: "create" as const,
              price: {
                currency: "usd" as const,
                unit_amount: Number(form.stripe_sync.price.unit_amount),
                ...(form.stripe_sync.price.billing_scheme.trim()
                  ? { billing_scheme: form.stripe_sync.price.billing_scheme.trim() }
                  : {}),
                type: "recurring" as const,
                recurring_interval: form.stripe_sync.price.recurring_interval,
                recurring_interval_count: Number(
                  form.stripe_sync.price.recurring_interval_count,
                ),
                ...(form.stripe_sync.price.lookup_key.trim()
                  ? { lookup_key: form.stripe_sync.price.lookup_key.trim() }
                  : {}),
              },
            }
          : {
              mode: "create" as const,
              price: {
                currency: "usd" as const,
                unit_amount: Number(form.stripe_sync.price.unit_amount),
                ...(form.stripe_sync.price.billing_scheme.trim()
                  ? { billing_scheme: form.stripe_sync.price.billing_scheme.trim() }
                  : {}),
                type: "one_time" as const,
                ...(form.stripe_sync.price.lookup_key.trim()
                  ? { lookup_key: form.stripe_sync.price.lookup_key.trim() }
                  : {}),
              },
            }
        : {
            mode: "bind_existing" as const,
            stripe_product_id: form.stripe_sync.stripe_product_id.trim(),
            stripe_price_id: form.stripe_sync.stripe_price_id.trim(),
          };

    const payload: BillingCreateProductRequest = {
      product_code: form.product_code.trim(),
      product_family: form.product_family,
      name: form.name.trim(),
      product_type: form.product_type,
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
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
    };

    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
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
      const created = await billingAdminApiClient.createProduct(buildPayload());
      setSuccessMessage("Billing Product created.");
      router.push(
        `/cms/billing/products/${encodeURIComponent(created.product_code)}`,
      );
    } catch (submitError) {
      const resolved = resolveBillingAdminError(
        submitError,
        "Failed to create billing product",
      );
      setErrorMessage(resolved.message);
      setErrorCode(resolved.code || null);
      setFieldErrors(resolved.field_errors);
    } finally {
      setSubmitting(false);
    }
  }

  const createMode = form.stripe_sync.mode === "create";
  const subscriptionMode = form.product_type === "subscription";
  const activeFeaturePolicies = featurePolicies.filter((policy) => policy.active);

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
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
              Billing Product Create
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              创建 Billing Product
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              表单字段严格按 `billing_admin_form_spec.md` 和
              `billing_admin_openapi.md` 渲染。
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 self-start rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            {submitting ? "Creating..." : "Create Product"}
          </button>
        </div>

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
        title="基础字段"
        description="只渲染创建页文档定义的可编辑字段。"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="product_code" error={fieldErrors.product_code}>
            <input
              value={form.product_code}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  product_code: event.target.value,
                }))
              }
              placeholder="classification_pack_500"
              maxLength={64}
              className={inputClassName(Boolean(fieldErrors.product_code))}
            />
          </Field>

          <Field label="product_family" error={fieldErrors.product_family}>
            <select
              value={form.product_family}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  product_family: event.target.value as BillingProductFamily,
                }))
              }
              className={inputClassName(Boolean(fieldErrors.product_family))}
            >
              <option value="simulate">simulate</option>
              <option value="classification">classification</option>
            </select>
          </Field>

          <Field label="name" error={fieldErrors.name}>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              maxLength={128}
              className={inputClassName(Boolean(fieldErrors.name))}
            />
          </Field>

          <Field label="description" error={fieldErrors.description}>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              className={textareaClassName(Boolean(fieldErrors.description))}
            />
          </Field>

          <Field label="product_type" error={fieldErrors.product_type}>
            <div className="grid gap-3 sm:grid-cols-2">
              <RadioCard
                checked={form.product_type === "subscription"}
                onClick={() => updateProductType("subscription")}
                title="subscription"
                description="Recurring Stripe Price"
              />
              <RadioCard
                checked={form.product_type === "credit_pack"}
                onClick={() => updateProductType("credit_pack")}
                title="credit_pack"
                description="One-time Stripe Price"
              />
            </div>
          </Field>

          <Field label="active" error={fieldErrors.active}>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
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
                setForm((current) => ({
                  ...current,
                  sort_order: event.target.value,
                }))
              }
              className={inputClassName(Boolean(fieldErrors.sort_order))}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="config_json"
        description="支持添加多条 config_json，每条都按文档约束 feature_key、grant_mode 和 credits 联动。"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BillingAdminFieldError error={fieldErrors.config_json} />
            <button
              type="button"
              onClick={addConfigJsonEntry}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <PlusCircle className="h-4 w-4" />
              Add config_json
            </button>
          </div>

          {featurePoliciesError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              {featurePoliciesError}
            </div>
          ) : null}

          {form.config_json.map((entry, index) => {
            const showCredits = entry.grant_mode === "prepaid_quota";
            const hasMissingOption =
              entry.feature_key &&
              !activeFeaturePolicies.some(
                (policy) => policy.feature_key === entry.feature_key,
              );

            return (
              <div
                key={`config_json_${index}`}
                className="rounded-[1.6rem] border border-black/8 bg-slate-950/[0.02] p-5"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      config_json.{index}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      一条 config_json 对应一条 grant 配置。
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
                    <select
                      value={entry.feature_key}
                      onChange={(event) =>
                        updateConfigEntry(index, {
                          feature_key: event.target.value,
                        })
                      }
                      disabled={featurePoliciesLoading}
                      className={inputClassName(
                        Boolean(fieldErrors[`config_json.${index}.feature_key`]),
                      )}
                    >
                      <option value="">
                        {featurePoliciesLoading
                          ? "Loading feature_key..."
                          : "Select feature_key"}
                      </option>
                      {activeFeaturePolicies.map((policy) => (
                        <option key={policy.feature_key} value={policy.feature_key}>
                          {formatFeaturePolicyOption(policy)}
                        </option>
                      ))}
                      {hasMissingOption ? (
                        <option value={entry.feature_key}>
                          {entry.feature_key} (inactive)
                        </option>
                      ) : null}
                    </select>
                  </Field>

                  <Field
                    label={`config_json.${index}.grant_mode`}
                    error={fieldErrors[`config_json.${index}.grant_mode`]}
                  >
                    <select
                      value={entry.grant_mode}
                      onChange={(event) =>
                        updateGrantMode(index, event.target.value as BillingGrantMode)
                      }
                      className={inputClassName(
                        Boolean(fieldErrors[`config_json.${index}.grant_mode`]),
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
                          Boolean(fieldErrors[`config_json.${index}.credits`]),
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
      </FormSection>

      <FormSection
        title="stripe_sync"
        description="支持 create 和 bind_existing 两种模式。"
      >
        <div className="space-y-6">
          <Field label="stripe_sync.mode" error={fieldErrors["stripe_sync.mode"]}>
            <div className="grid gap-3 sm:grid-cols-2">
              <RadioCard
                checked={form.stripe_sync.mode === "create"}
                onClick={() => updateStripeSyncMode("create")}
                title="create"
                description="Create Stripe Product / Price"
              />
              <RadioCard
                checked={form.stripe_sync.mode === "bind_existing"}
                onClick={() => updateStripeSyncMode("bind_existing")}
                title="bind_existing"
                description="Bind existing Stripe objects"
              />
            </div>
          </Field>

          {createMode ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="currency" error={fieldErrors["stripe_sync.price.currency"]}>
                <select
                  value={form.stripe_sync.price.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stripe_sync: {
                        ...current.stripe_sync,
                        price: {
                          ...current.stripe_sync.price,
                          currency: event.target.value as "usd",
                        },
                      },
                    }))
                  }
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price.currency"]),
                  )}
                >
                  <option value="usd">usd</option>
                </select>
              </Field>

              <Field
                label="unit_amount"
                error={fieldErrors["stripe_sync.price.unit_amount"]}
              >
                <input
                  type="number"
                  min={1}
                  value={form.stripe_sync.price.unit_amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stripe_sync: {
                        ...current.stripe_sync,
                        price: {
                          ...current.stripe_sync.price,
                          unit_amount: event.target.value,
                        },
                      },
                    }))
                  }
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price.unit_amount"]),
                  )}
                />
              </Field>

              <Field
                label="billing_scheme"
                error={fieldErrors["stripe_sync.price.billing_scheme"]}
              >
                <input
                  value={form.stripe_sync.price.billing_scheme}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stripe_sync: {
                        ...current.stripe_sync,
                        price: {
                          ...current.stripe_sync.price,
                          billing_scheme: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="per_unit"
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price.billing_scheme"]),
                  )}
                />
              </Field>

              <Field label="type" error={fieldErrors["stripe_sync.price.type"]}>
                <input
                  value={subscriptionMode ? "recurring" : "one_time"}
                  readOnly
                  className={inputClassName(false)}
                />
              </Field>

              {subscriptionMode ? (
                <>
                  <Field
                    label="recurring_interval"
                    error={fieldErrors["stripe_sync.price.recurring_interval"]}
                  >
                    <select
                      value={form.stripe_sync.price.recurring_interval}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stripe_sync: {
                            ...current.stripe_sync,
                            price: {
                              ...current.stripe_sync.price,
                              recurring_interval:
                                event.target.value as BillingRecurringInterval,
                            },
                          },
                        }))
                      }
                      className={inputClassName(
                        Boolean(fieldErrors["stripe_sync.price.recurring_interval"]),
                      )}
                    >
                      <option value="month">month</option>
                      <option value="year">year</option>
                      <option value="week">week</option>
                      <option value="day">day</option>
                    </select>
                  </Field>

                  <Field
                    label="recurring_interval_count"
                    error={
                      fieldErrors["stripe_sync.price.recurring_interval_count"]
                    }
                  >
                    <input
                      type="number"
                      min={1}
                      value={form.stripe_sync.price.recurring_interval_count}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stripe_sync: {
                            ...current.stripe_sync,
                            price: {
                              ...current.stripe_sync.price,
                              recurring_interval_count: event.target.value,
                            },
                          },
                        }))
                      }
                      className={inputClassName(
                        Boolean(
                          fieldErrors["stripe_sync.price.recurring_interval_count"],
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

              <Field
                label="lookup_key"
                error={fieldErrors["stripe_sync.price.lookup_key"]}
              >
                <input
                  value={form.stripe_sync.price.lookup_key}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stripe_sync: {
                        ...current.stripe_sync,
                        price: {
                          ...current.stripe_sync.price,
                          lookup_key: event.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="simulate_monthly_usd_v1"
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.price.lookup_key"]),
                  )}
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="stripe_sync.stripe_product_id"
                error={fieldErrors["stripe_sync.stripe_product_id"]}
              >
                <input
                  value={form.stripe_sync.stripe_product_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stripe_sync: {
                        ...current.stripe_sync,
                        stripe_product_id: event.target.value,
                      },
                    }))
                  }
                  placeholder="prod_xxx"
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.stripe_product_id"]),
                  )}
                />
              </Field>

              <Field
                label="stripe_sync.stripe_price_id"
                error={fieldErrors["stripe_sync.stripe_price_id"]}
              >
                <input
                  value={form.stripe_sync.stripe_price_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stripe_sync: {
                        ...current.stripe_sync,
                        stripe_price_id: event.target.value,
                      },
                    }))
                  }
                  placeholder="price_xxx"
                  className={inputClassName(
                    Boolean(fieldErrors["stripe_sync.stripe_price_id"]),
                  )}
                />
              </Field>
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

function RadioCard({
  checked,
  onClick,
  title,
  description,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        checked
          ? "rounded-2xl border border-slate-950 bg-slate-950 px-4 py-4 text-left text-white"
          : "rounded-2xl border border-black/10 bg-white px-4 py-4 text-left text-slate-900 transition hover:border-black/20"
      }
    >
      <p className="font-semibold">{title}</p>
      <p className={checked ? "mt-1 text-sm text-white/75" : "mt-1 text-sm text-slate-500"}>
        {description}
      </p>
    </button>
  );
}

function formatFeaturePolicyOption(policy: BillingFeaturePolicy) {
  return policy.name
    ? `${policy.feature_key} · ${policy.name}`
    : policy.feature_key;
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
