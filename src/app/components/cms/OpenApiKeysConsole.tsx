"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  PlusCircle,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";

import { BillingAdminFeedback } from "@/app/components/cms/BillingAdminFeedback";
import {
  billingAdminApiClient,
  isBillingAdminApiError,
} from "@/app/lib/billing-admin-api";
import type {
  OpenApiClient,
  OpenApiKey,
  OpenApiKeyCreateResponse,
  OpenApiKeyScope,
  OpenApiKeyStatus,
} from "@/types/billing";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const KEY_STATUSES: OpenApiKeyStatus[] = ["active", "revoked"];
const KEY_SCOPES: OpenApiKeyScope[] = ["test", "live"];

interface FiltersState {
  client_id: string;
  status: OpenApiKeyStatus | "";
  keyword: string;
}

interface CreateFormState {
  client_id: string;
  key_scope: OpenApiKeyScope;
  key: string;
  rpm_limit: string;
  burst_limit: string;
  expires_at: string;
  secret_version: string;
}

const DEFAULT_FILTERS: FiltersState = {
  client_id: "",
  status: "",
  keyword: "",
};

const DEFAULT_CREATE_FORM: CreateFormState = {
  client_id: "",
  key_scope: "test",
  key: "",
  rpm_limit: "600",
  burst_limit: "150",
  expires_at: "",
  secret_version: "v1",
};

export default function OpenApiKeysConsole() {
  const [clients, setClients] = useState<OpenApiClient[]>([]);
  const [keys, setKeys] = useState<OpenApiKey[]>([]);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FiltersState>(DEFAULT_FILTERS);
  const [createForm, setCreateForm] =
    useState<CreateFormState>(DEFAULT_CREATE_FORM);
  const [createdKey, setCreatedKey] = useState<OpenApiKeyCreateResponse | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clientById = useMemo(() => {
    return new Map(clients.map((client) => [client.client_id, client]));
  }, [clients]);

  async function loadClients() {
    try {
      setClientsLoading(true);
      const data = await billingAdminApiClient.listOpenApiClients({
        page: 1,
        page_size: 100,
      });
      setClients(data.items);
      if (!createForm.client_id && data.items.length > 0) {
        setCreateForm((current) => ({
          ...current,
          client_id: String(data.items[0].client_id),
        }));
      }
    } catch (error) {
      setResolvedError(error, "Failed to load OpenAPI clients");
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadKeys(nextPage = page, nextPageSize = pageSize) {
    try {
      setLoading(true);
      setErrorMessage(null);
      setErrorCode(null);

      const data = await billingAdminApiClient.listOpenApiKeys({
        client_id: appliedFilters.client_id
          ? Number(appliedFilters.client_id)
          : undefined,
        status: appliedFilters.status || undefined,
        keyword: appliedFilters.keyword.trim() || undefined,
        page: nextPage,
        page_size: nextPageSize,
      });

      setKeys(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
    } catch (error) {
      setResolvedError(error, "Failed to load OpenAPI keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    void loadKeys(page, pageSize);
  }, [page, pageSize, appliedFilters]);

  async function handleCreate() {
    const clientId = Number(createForm.client_id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      setErrorMessage("Select an existing OpenAPI client.");
      setErrorCode("validation_error");
      return;
    }

    const rpmLimit = Number(createForm.rpm_limit);
    const burstLimit = Number(createForm.burst_limit);
    if (rpmLimit <= 0 || burstLimit <= 0) {
      setErrorMessage("RPM limit and burst limit must be greater than 0.");
      setErrorCode("validation_error");
      return;
    }

    try {
      setActionKey("create");
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);
      setCreatedKey(null);

      const created = await billingAdminApiClient.createOpenApiKey({
        client_id: clientId,
        key_scope: createForm.key_scope,
        key: createForm.key.trim() || undefined,
        rpm_limit: rpmLimit,
        burst_limit: burstLimit,
        expires_at: createForm.expires_at
          ? new Date(createForm.expires_at).toISOString()
          : null,
        secret_version: createForm.secret_version.trim() || "v1",
      });

      setCreatedKey(created);
      setSuccessMessage(`OpenAPI key ${created.key_prefix} issued.`);
      setCreateForm((current) => ({
        ...DEFAULT_CREATE_FORM,
        client_id: current.client_id,
      }));
      await loadKeys(1, pageSize);
      setPage(1);
    } catch (error) {
      setResolvedError(error, "Failed to issue OpenAPI key");
    } finally {
      setActionKey(null);
    }
  }

  async function handleRevoke(key: OpenApiKey) {
    const confirmed = window.confirm(
      `Revoke OpenAPI key ${key.key_prefix}? This cannot reveal or restore the plaintext key.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setActionKey(`revoke:${key.key_id}`);
      setErrorMessage(null);
      setErrorCode(null);
      setSuccessMessage(null);

      await billingAdminApiClient.revokeOpenApiKey(key.key_id);
      setSuccessMessage(`OpenAPI key ${key.key_prefix} revoked.`);
      await loadKeys(page, pageSize);
    } catch (error) {
      setResolvedError(error, "Failed to revoke OpenAPI key");
    } finally {
      setActionKey(null);
    }
  }

  function handleApplyFilters() {
    setSuccessMessage(null);
    setPage(1);
    setAppliedFilters({
      client_id: filters.client_id,
      status: filters.status,
      keyword: filters.keyword.trim(),
    });
  }

  async function copyCreatedKey() {
    if (!createdKey) {
      return;
    }
    await navigator.clipboard.writeText(createdKey.api_key);
    setSuccessMessage("Plaintext API key copied.");
  }

  function setResolvedError(error: unknown, fallback: string) {
    if (isBillingAdminApiError(error)) {
      setErrorMessage(error.detail?.message || error.message || fallback);
      setErrorCode(error.detail?.code || null);
      return;
    }
    setErrorMessage(error instanceof Error ? error.message : fallback);
    setErrorCode(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-black/5 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            OpenAPI Key Console
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Issue and manage API keys
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadClients();
            void loadKeys(page, pageSize);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <BillingAdminFeedback
        successMessage={successMessage}
        errorMessage={errorMessage}
        errorCode={errorCode}
      />

      {createdKey ? (
        <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                One-time plaintext key
              </div>
              <p className="mt-2 text-sm text-emerald-800">
                Store this value now. Future views only show the prefix.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyCreatedKey()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>
          <input
            readOnly
            value={createdKey.api_key}
            className="mt-4 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-mono text-sm text-slate-950 outline-none"
          />
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-950">Issue key</h3>
            <p className="text-sm text-slate-500">
              Creates one active key for an existing t_openapi_client.id.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Client">
            <select
              value={createForm.client_id}
              disabled={clientsLoading}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  client_id: event.target.value,
                }))
              }
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
            >
              {clients.length === 0 ? (
                <option value="">No clients found</option>
              ) : null}
              {clients.map((client) => (
                <option key={client.client_id} value={client.client_id}>
                  {client.client_code} · {client.name} · id {client.client_id}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Scope">
            <select
              value={createForm.key_scope}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  key_scope: event.target.value as OpenApiKeyScope,
                }))
              }
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400"
            >
              {KEY_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Secret version">
            <input
              value={createForm.secret_version}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  secret_version: event.target.value,
                }))
              }
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
            />
          </Field>

          <Field label="RPM limit">
            <input
              type="number"
              min="1"
              value={createForm.rpm_limit}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  rpm_limit: event.target.value,
                }))
              }
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
            />
          </Field>

          <Field label="Burst limit">
            <input
              type="number"
              min="1"
              value={createForm.burst_limit}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  burst_limit: event.target.value,
                }))
              }
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
            />
          </Field>

          <Field label="Expires at">
            <input
              type="datetime-local"
              value={createForm.expires_at}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  expires_at: event.target.value,
                }))
              }
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-400"
            />
          </Field>

          <div className="lg:col-span-3">
            <Field label="Manual key">
              <input
                value={createForm.key}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    key: event.target.value,
                  }))
                }
                placeholder="Optional. Leave blank to generate bb_test_... or bb_live_..."
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 font-mono text-sm outline-none focus:border-slate-400"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={actionKey === "create" || clients.length === 0}
            onClick={() => void handleCreate()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {actionKey === "create" ? "Issuing..." : "Issue API Key"}
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Key inventory
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Stored key records
            </h3>
          </div>

          <div className="grid gap-3 md:grid-cols-[220px_160px_minmax(220px,1fr)_auto]">
            <select
              value={filters.client_id}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  client_id: event.target.value,
                }))
              }
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.client_id} value={client.client_id}>
                  {client.client_code}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as OpenApiKeyStatus | "",
                }))
              }
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
            >
              <option value="">All statuses</option>
              {KEY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <input
              value={filters.keyword}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))
              }
              placeholder="Search prefix, client code, name"
              className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />

            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Limits</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      Loading OpenAPI keys...
                    </td>
                  </tr>
                ) : keys.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No OpenAPI keys found.
                    </td>
                  </tr>
                ) : (
                  keys.map((key) => {
                    const client = clientById.get(key.client_id);
                    return (
                      <tr key={key.key_id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-mono font-semibold text-slate-950">
                            {key.key_prefix}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <StatusBadge status={key.status} />
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {key.secret_version}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-950">
                            {key.client_code}
                          </div>
                          <div className="mt-1 text-slate-500">
                            {client?.name || key.client_name} · id {key.client_id}
                          </div>
                          {key.client_status === "disabled" ? (
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                              <Ban className="h-3 w-3" />
                              client disabled
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div>{key.rpm_limit} rpm</div>
                          <div>{key.burst_limit} burst</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatDate(key.expires_at) || "Never"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatDate(key.created_at)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            disabled={
                              key.status === "revoked" ||
                              actionKey === `revoke:${key.key_id}`
                            }
                            onClick={() => void handleRevoke(key)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {actionKey === `revoke:${key.key_id}`
                              ? "Revoking..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total} records
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: OpenApiKeyStatus }) {
  const active = status === "active";
  return (
    <span
      className={
        active
          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
          : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
      }
    >
      {status}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
