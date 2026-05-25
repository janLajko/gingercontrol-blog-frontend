"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Eye,
  Pencil,
  PlusCircle,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";

import {
  invitationCodeApiClient,
  isInvitationCodeApiError,
} from "@/app/lib/invitation-code-api";
import type {
  InvitationCode,
  InvitationCodeCreateRequest,
  InvitationCodeStatus,
  InvitationCodeType,
  InvitationCodeUsage,
} from "@/types/invitation-code";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const CODE_TYPES: InvitationCodeType[] = ["radar", "register", "sandbox"];
const CODE_STATUSES: InvitationCodeStatus[] = [
  "active",
  "disabled",
  "expired",
  "exhausted",
];

interface FiltersState {
  code_type: InvitationCodeType | "";
  status: InvitationCodeStatus | "";
  keyword: string;
}

interface FormState {
  code: string;
  code_type: InvitationCodeType;
  prefix: string;
  code_length: string;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  status: InvitationCodeStatus;
  note: string;
  created_by: string;
}

const DEFAULT_FILTERS: FiltersState = {
  code_type: "",
  status: "",
  keyword: "",
};

const DEFAULT_FORM: FormState = {
  code: "",
  code_type: "radar",
  prefix: "GC-",
  code_length: "7",
  max_uses: "1",
  valid_from: "",
  valid_until: "",
  status: "active",
  note: "",
  created_by: "",
};

export default function InvitationCodesConsole() {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(DEFAULT_FORM);
  const [editingCode, setEditingCode] = useState<InvitationCode | null>(null);
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM);
  const [usageCode, setUsageCode] = useState<InvitationCode | null>(null);
  const [usages, setUsages] = useState<InvitationCodeUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageTotal, setUsageTotal] = useState(0);

  async function loadCodes(nextPage = page, nextPageSize = pageSize) {
    try {
      setLoading(true);
      setErrorMessage(null);

      const data = await invitationCodeApiClient.listCodes({
        code_type: appliedFilters.code_type || undefined,
        status: appliedFilters.status || undefined,
        keyword: appliedFilters.keyword.trim() || undefined,
        page: nextPage,
        page_size: nextPageSize,
      });

      setCodes(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to load invitation codes"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCodes(page, pageSize);
  }, [page, pageSize, appliedFilters]);

  async function handleCreate() {
    try {
      setActionKey("create");
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = formToCreatePayload(createForm);
      const created = await invitationCodeApiClient.createCode(payload);

      setSuccessMessage(`邀请码 ${created.code} 已创建`);
      setCreateForm(DEFAULT_FORM);
      await loadCodes(1, pageSize);
      setPage(1);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to create invitation code"));
    } finally {
      setActionKey(null);
    }
  }

  async function handleUpdate() {
    if (!editingCode) {
      return;
    }

    try {
      setActionKey(`edit:${editingCode.id}`);
      setErrorMessage(null);
      setSuccessMessage(null);

      const updated = await invitationCodeApiClient.patchCode(
        editingCode.id,
        formToPatchPayload(editForm),
      );

      setSuccessMessage(`邀请码 ${updated.code} 已更新`);
      setEditingCode(null);
      await loadCodes(page, pageSize);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to update invitation code"));
    } finally {
      setActionKey(null);
    }
  }

  async function handleDelete(code: InvitationCode) {
    const confirmed = window.confirm(`确认删除邀请码 ${code.code} 吗？使用记录也会被删除。`);
    if (!confirmed) {
      return;
    }

    try {
      setActionKey(`delete:${code.id}`);
      setErrorMessage(null);
      setSuccessMessage(null);

      await invitationCodeApiClient.deleteCode(code.id);
      setSuccessMessage(`邀请码 ${code.code} 已删除`);
      if (usageCode?.id === code.id) {
        setUsageCode(null);
        setUsages([]);
        setUsageTotal(0);
      }
      await loadCodes(page, pageSize);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to delete invitation code"));
    } finally {
      setActionKey(null);
    }
  }

  async function handleLoadUsages(code: InvitationCode) {
    try {
      setUsageCode(code);
      setUsageLoading(true);
      setErrorMessage(null);

      const data = await invitationCodeApiClient.listUsages(code.id, 1, 20);
      setUsages(data.items);
      setUsageTotal(data.total);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to load invitation code usages"));
    } finally {
      setUsageLoading(false);
    }
  }

  function openEdit(code: InvitationCode) {
    setEditingCode(code);
    setEditForm(codeToForm(code));
  }

  function handleApplyFilters() {
    setSuccessMessage(null);
    setPage(1);
    setAppliedFilters({
      code_type: filters.code_type,
      status: filters.status,
      keyword: filters.keyword.trim(),
    });
  }

  function handleResetFilters() {
    setSuccessMessage(null);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 border-b border-black/8 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                邀请码管理
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                创建、筛选、修改、删除邀请码，并查看每个邀请码的使用记录。
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCodes(page, pageSize)}
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(220px,1fr)_140px_auto]">
            <SelectField
              label="code_type"
              value={filters.code_type}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  code_type: value as InvitationCodeType | "",
                }))
              }
              options={CODE_TYPES}
            />
            <SelectField
              label="status"
              value={filters.status}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: value as InvitationCodeStatus | "",
                }))
              }
              options={CODE_STATUSES}
            />
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
                  placeholder="code / note / created_by"
                  className="w-full rounded-2xl border border-black/10 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-slate-950"
                />
              </div>
            </label>
            <SelectField
              label="page_size"
              value={String(pageSize)}
              onChange={(value) => {
                setPage(1);
                setPageSize(Number(value));
              }}
              options={PAGE_SIZE_OPTIONS.map(String)}
              includeAll={false}
            />
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

          <Feedback
            loading={loading || Boolean(actionKey)}
            loadingMessage={actionKey ? "Saving invitation code..." : "Loading invitation codes..."}
            successMessage={successMessage}
            errorMessage={errorMessage}
          />
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            Loading invitation codes...
          </div>
        ) : codes.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-600">
            No invitation codes found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-950/[0.03] text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">code</th>
                    <th className="px-6 py-4 font-semibold">type</th>
                    <th className="px-6 py-4 font-semibold">usage</th>
                    <th className="px-6 py-4 font-semibold">valid</th>
                    <th className="px-6 py-4 font-semibold">status</th>
                    <th className="px-6 py-4 font-semibold">updated</th>
                    <th className="px-6 py-4 font-semibold">actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {codes.map((code) => (
                    <tr key={code.id} className="align-top transition hover:bg-black/[0.02]">
                      <td className="px-6 py-5 text-sm font-semibold text-slate-950">
                        {code.code}
                        {code.note ? (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {code.note}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {code.code_type}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {code.used_count} / {code.max_uses}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        <p>{formatDateTime(code.valid_from) || "No start"}</p>
                        <p>{formatDateTime(code.valid_until) || "No end"}</p>
                      </td>
                      <td className="px-6 py-5 text-sm">
                        <StatusBadge status={code.status} />
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {formatDateTime(code.updated_at)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <IconButton
                            label="Usage"
                            onClick={() => void handleLoadUsages(code)}
                            disabled={actionKey !== null}
                          >
                            <Eye className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Edit"
                            onClick={() => openEdit(code)}
                            disabled={actionKey !== null}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Delete"
                            onClick={() => void handleDelete(code)}
                            disabled={actionKey !== null}
                            danger
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-black/8 px-6 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Page {page} / {totalPages} · Total {total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-black/10 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-black/10 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="space-y-6">
        <CodeFormPanel
          title={editingCode ? `修改 ${editingCode.code}` : "创建邀请码"}
          form={editingCode ? editForm : createForm}
          setForm={editingCode ? setEditForm : setCreateForm}
          onSubmit={editingCode ? handleUpdate : handleCreate}
          submitLabel={editingCode ? "Save Changes" : "Create Code"}
          busy={actionKey !== null}
          editing={Boolean(editingCode)}
          onCancel={
            editingCode
              ? () => {
                  setEditingCode(null);
                  setEditForm(DEFAULT_FORM);
                }
              : undefined
          }
        />

        <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950">
                使用记录
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {usageCode ? usageCode.code : "选择一个邀请码查看记录"}
              </p>
            </div>
            {usageCode ? <StatusBadge status={usageCode.status} /> : null}
          </div>

          {usageLoading ? (
            <div className="mt-6 text-sm text-slate-500">Loading usages...</div>
          ) : !usageCode ? (
            <div className="mt-6 text-sm text-slate-500">
              使用表只展示 code、user_id、used_at。
            </div>
          ) : usages.length === 0 ? (
            <div className="mt-6 text-sm text-slate-500">No usage records.</div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">user_id</th>
                    <th className="py-3 font-semibold">used_at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {usages.map((usage) => (
                    <tr key={usage.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-800">
                        {usage.user_id}
                      </td>
                      <td className="py-3 text-slate-500">
                        {formatDateTime(usage.used_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Total {usageTotal}
              </p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function CodeFormPanel({
  title,
  form,
  setForm,
  onSubmit,
  submitLabel,
  busy,
  editing,
  onCancel,
}: {
  title: string;
  form: FormState;
  setForm: (value: FormState | ((current: FormState) => FormState)) => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  busy: boolean;
  editing: boolean;
  onCancel?: () => void;
}) {
  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-xl font-black tracking-tight text-slate-950">{title}</h3>
        <PlusCircle className="h-5 w-5 text-slate-500" />
      </div>

      <div className="space-y-4">
        {!editing ? (
          <TextField
            label="code"
            value={form.code}
            onChange={(value) => setForm((current) => ({ ...current, code: value }))}
            placeholder="留空由后端生成"
          />
        ) : (
          <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            code 不在编辑中修改
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="code_type"
            value={form.code_type}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                code_type: value as InvitationCodeType,
                prefix: defaultPrefix(value as InvitationCodeType),
              }))
            }
            options={CODE_TYPES}
            includeAll={false}
          />
          <SelectField
            label="status"
            value={form.status}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                status: value as InvitationCodeStatus,
              }))
            }
            options={CODE_STATUSES}
            includeAll={false}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="prefix"
            value={form.prefix}
            onChange={(value) => setForm((current) => ({ ...current, prefix: value }))}
          />
          <TextField
            label="code_length"
            type="number"
            value={form.code_length}
            onChange={(value) =>
              setForm((current) => ({ ...current, code_length: value }))
            }
          />
        </div>

        <TextField
          label="max_uses"
          type="number"
          value={form.max_uses}
          onChange={(value) => setForm((current) => ({ ...current, max_uses: value }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="valid_from"
            type="datetime-local"
            value={form.valid_from}
            onChange={(value) =>
              setForm((current) => ({ ...current, valid_from: value }))
            }
          />
          <TextField
            label="valid_until"
            type="datetime-local"
            value={form.valid_until}
            onChange={(value) =>
              setForm((current) => ({ ...current, valid_until: value }))
            }
          />
        </div>

        <TextField
          label="created_by"
          value={form.created_by}
          onChange={(value) =>
            setForm((current) => ({ ...current, created_by: value }))
          }
          disabled={editing}
        />

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            note
          </span>
          <textarea
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            rows={3}
            className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={busy}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  includeAll = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  includeAll?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950"
      >
        {includeAll ? <option value="">All</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={
        danger
          ? "rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          : "rounded-xl border border-black/10 bg-white p-2 text-slate-700 transition hover:border-black/20 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: InvitationCodeStatus }) {
  const className =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "disabled"
        ? "bg-slate-200 text-slate-700"
        : status === "expired"
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

function Feedback({
  loading,
  loadingMessage,
  successMessage,
  errorMessage,
}: {
  loading: boolean;
  loadingMessage: string;
  successMessage?: string | null;
  errorMessage?: string | null;
}) {
  if (!loading && !successMessage && !errorMessage) {
    return null;
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
          {loadingMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function formToCreatePayload(form: FormState): InvitationCodeCreateRequest {
  return {
    code: form.code.trim() || undefined,
    code_type: form.code_type,
    prefix: form.prefix,
    code_length: Number(form.code_length),
    max_uses: Number(form.max_uses),
    valid_from: toIsoDateTime(form.valid_from),
    valid_until: toIsoDateTime(form.valid_until),
    status: form.status,
    note: form.note.trim() || undefined,
    created_by: form.created_by.trim() || undefined,
  };
}

function formToPatchPayload(form: FormState) {
  return {
    code_type: form.code_type,
    prefix: form.prefix,
    code_length: Number(form.code_length),
    max_uses: Number(form.max_uses),
    valid_from: toIsoDateTime(form.valid_from),
    valid_until: toIsoDateTime(form.valid_until),
    status: form.status,
    note: form.note.trim() || null,
  };
}

function codeToForm(code: InvitationCode): FormState {
  return {
    code: code.code,
    code_type: code.code_type,
    prefix: code.prefix,
    code_length: String(code.code_length),
    max_uses: String(code.max_uses),
    valid_from: toDatetimeLocal(code.valid_from),
    valid_until: toDatetimeLocal(code.valid_until),
    status: code.status,
    note: code.note || "",
    created_by: code.created_by || "",
  };
}

function defaultPrefix(codeType: InvitationCodeType) {
  if (codeType === "register") {
    return "REG-";
  }
  if (codeType === "sandbox") {
    return "SBX-";
  }
  return "GC";
}

function toIsoDateTime(value: string) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function toDatetimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveError(error: unknown, fallback: string) {
  if (isInvitationCodeApiError(error)) {
    return error.detail?.code
      ? `${error.detail.code}: ${error.message}`
      : error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
