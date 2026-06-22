"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Eye,
  PlusCircle,
  RefreshCcw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";

import {
  isUserManageApiError,
  userManageApiClient,
} from "@/app/lib/user-manage-api";
import type { ManagedUser, ManagedUserCreateRequest } from "@/types/user-manage";

const EMAIL_DOMAIN = "@gingercontrol.com";
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

interface FormState {
  email_prefix: string;
  name: string;
  company_name: string;
  job_title: string;
  callsign: string;
  language: string;
}

const DEFAULT_FORM: FormState = {
  email_prefix: "",
  name: "",
  company_name: "",
  job_title: "",
  callsign: "",
  language: "",
};

export default function UserManageConsole() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadUsers(nextPage = page, nextPageSize = pageSize) {
    try {
      setLoading(true);
      setErrorMessage(null);

      const data = await userManageApiClient.listUsers({
        keyword: appliedKeyword || undefined,
        page: nextPage,
        page_size: nextPageSize,
      });

      setUsers(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(page, pageSize);
  }, [page, pageSize, appliedKeyword]);

  async function handleCreate() {
    try {
      setActionKey("create");
      setErrorMessage(null);
      setSuccessMessage(null);

      const created = await userManageApiClient.createUser(formToPayload(form));
      setSuccessMessage(`用户 ${created.email} 已创建`);
      setForm(DEFAULT_FORM);
      setSelectedUser(created);
      await loadUsers(1, pageSize);
      setPage(1);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to create user"));
    } finally {
      setActionKey(null);
    }
  }

  async function handleLoadDetail(user: ManagedUser) {
    try {
      setDetailLoading(true);
      setErrorMessage(null);

      const detail = await userManageApiClient.getUser(user.id);
      setSelectedUser(detail);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to load user detail"));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete(user: ManagedUser) {
    const confirmed = window.confirm(`确认逻辑删除用户 ${user.email} 吗？`);
    if (!confirmed) {
      return;
    }

    try {
      setActionKey(`delete:${user.id}`);
      setErrorMessage(null);
      setSuccessMessage(null);

      await userManageApiClient.deleteUser(user.id);
      setSuccessMessage(`用户 ${user.email} 已逻辑删除`);
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
      await loadUsers(page, pageSize);
    } catch (error) {
      setErrorMessage(resolveError(error, "Failed to delete user"));
    } finally {
      setActionKey(null);
    }
  }

  function handleApplyFilters() {
    setSuccessMessage(null);
    setPage(1);
    setAppliedKeyword(keyword.trim());
  }

  function handleResetFilters() {
    setSuccessMessage(null);
    setKeyword("");
    setAppliedKeyword("");
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const busy = actionKey !== null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-4 border-b border-black/8 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                User Manage
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                管理 gingercontrol.com 手动用户，支持新增、详情查看和逻辑删除。
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadUsers(page, pageSize)}
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_140px_auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                keyword
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="email / name / company / callsign"
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
            loading={loading || busy || detailLoading}
            loadingMessage={
              busy
                ? "Saving user..."
                : detailLoading
                  ? "Loading user detail..."
                  : "Loading users..."
            }
            successMessage={successMessage}
            errorMessage={errorMessage}
          />
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-600">No users found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-950/[0.03] text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">email</th>
                    <th className="px-6 py-4 font-semibold">profile</th>
                    <th className="px-6 py-4 font-semibold">source</th>
                    <th className="px-6 py-4 font-semibold">verified</th>
                    <th className="px-6 py-4 font-semibold">created</th>
                    <th className="px-6 py-4 font-semibold">actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="align-top transition hover:bg-black/[0.02]"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-slate-950">
                        {user.email}
                        <p className="mt-1 text-xs font-normal text-slate-500">
                          ID {user.id}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        <p>{user.name || "No name"}</p>
                        <p className="text-xs text-slate-500">
                          {user.company_name || "No company"}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {user.source || "-"}
                      </td>
                      <td className="px-6 py-5 text-sm">
                        <BooleanBadge value={user.email_verified} />
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500">
                        {formatDateTime(user.created_at)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <IconButton
                            label="Detail"
                            onClick={() => void handleLoadDetail(user)}
                            disabled={busy}
                          >
                            <Eye className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Delete"
                            onClick={() => void handleDelete(user)}
                            disabled={busy}
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
        <UserCreatePanel
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          busy={busy}
        />
        <UserDetailPanel user={selectedUser} loading={detailLoading} />
      </aside>
    </div>
  );
}

function UserCreatePanel({
  form,
  setForm,
  onSubmit,
  busy,
}: {
  form: FormState;
  setForm: (value: FormState | ((current: FormState) => FormState)) => void;
  onSubmit: () => void | Promise<void>;
  busy: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-xl font-black tracking-tight text-slate-950">
          新增用户
        </h3>
        <UserPlus className="h-5 w-5 text-slate-500" />
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            email
          </span>
          <div className="flex overflow-hidden rounded-2xl border border-black/10 bg-white focus-within:border-slate-950">
            <input
              value={form.email_prefix}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email_prefix: event.target.value,
                }))
              }
              placeholder="name"
              className="min-w-0 flex-1 px-4 py-3 text-slate-900 outline-none"
            />
            <span className="flex items-center border-l border-black/10 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
              {EMAIL_DOMAIN}
            </span>
          </div>
        </label>

        <TextField
          label="name"
          value={form.name}
          onChange={(value) => setForm((current) => ({ ...current, name: value }))}
        />
        <TextField
          label="company_name"
          value={form.company_name}
          onChange={(value) =>
            setForm((current) => ({ ...current, company_name: value }))
          }
        />
        <TextField
          label="job_title"
          value={form.job_title}
          onChange={(value) =>
            setForm((current) => ({ ...current, job_title: value }))
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="callsign"
            value={form.callsign}
            onChange={(value) =>
              setForm((current) => ({ ...current, callsign: value }))
            }
          />
          <TextField
            label="language"
            value={form.language}
            onChange={(value) =>
              setForm((current) => ({ ...current, language: value }))
            }
            placeholder="en"
          />
        </div>

        <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          默认写入 profile_completed=true、email_verified=true、source=manual、password=123456。
        </div>

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={busy || !form.email_prefix.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Create User
        </button>
      </div>
    </section>
  );
}

function UserDetailPanel({
  user,
  loading,
}: {
  user: ManagedUser | null;
  loading: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-950">
            用户详情
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {user ? user.email : "选择一个用户查看详情"}
          </p>
        </div>
        {user ? <BooleanBadge value={user.email_verified} /> : null}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading detail...</div>
      ) : !user ? (
        <div className="text-sm text-slate-500">
          详情会展示 users 表中的关键账号字段。
        </div>
      ) : (
        <dl className="grid gap-3 text-sm">
          <DetailRow label="id" value={String(user.id)} />
          <DetailRow label="email" value={user.email} />
          <DetailRow label="name" value={user.name} />
          <DetailRow label="company_name" value={user.company_name} />
          <DetailRow label="job_title" value={user.job_title} />
          <DetailRow label="provider" value={user.provider} />
          <DetailRow label="provider_sub" value={user.provider_sub} />
          <DetailRow label="source" value={user.source} />
          <DetailRow label="callsign" value={user.callsign} />
          <DetailRow label="language" value={user.language} />
          <DetailRow label="password" value={user.password} />
          <DetailRow
            label="profile_completed"
            value={user.profile_completed ? "true" : "false"}
          />
          <DetailRow
            label="email_verified"
            value={user.email_verified ? "true" : "false"}
          />
          <DetailRow label="last_login_at" value={formatDateTime(user.last_login_at)} />
          <DetailRow label="created_at" value={formatDateTime(user.created_at)} />
          <DetailRow label="updated_at" value={formatDateTime(user.updated_at)} />
        </dl>
      )}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-950"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
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
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid gap-1 rounded-2xl border border-black/8 bg-white/70 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="break-words font-medium text-slate-800">{value || "-"}</dd>
    </div>
  );
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      className={
        value
          ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
          : "inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
      }
    >
      {value ? "true" : "false"}
    </span>
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
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={
        danger
          ? "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          : "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-slate-600 transition hover:border-black/20 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
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

function formToPayload(form: FormState): ManagedUserCreateRequest {
  return {
    email_prefix: form.email_prefix.trim().toLowerCase(),
    name: blankToNull(form.name),
    company_name: blankToNull(form.company_name),
    job_title: blankToNull(form.job_title),
    callsign: blankToNull(form.callsign),
    language: blankToNull(form.language),
  };
}

function blankToNull(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveError(error: unknown, fallback: string) {
  if (isUserManageApiError(error)) {
    return error.detail?.message || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
