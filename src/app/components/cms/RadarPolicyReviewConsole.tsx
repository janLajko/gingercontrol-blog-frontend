"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FileJson,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";

import { cn } from "@/app/lib/utils";
import type {
  JsonValue,
  RadarImpactRow,
  RadarPolicyUpdateDetail,
  RadarPolicyUpdateSummary,
} from "@/app/types/radar-policy";

type PolicyJson = { [key: string]: JsonValue };
type JsonArrayItem = { [key: string]: JsonValue };
type EditorMode = "structured" | "raw";

const emptyPolicyJson: PolicyJson = {
  source: {},
  hts_modifications: [],
  measures: [],
  scope_sets: [],
};

export default function RadarPolicyReviewConsole() {
  const [updates, setUpdates] = useState<RadarPolicyUpdateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RadarPolicyUpdateDetail | null>(null);
  const [impactJson, setImpactJson] = useState<PolicyJson>(emptyPolicyJson);
  const [rawJson, setRawJson] = useState("");
  const [impacts, setImpacts] = useState<RadarImpactRow[]>([]);
  const [mode, setMode] = useState<EditorMode>("structured");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReviewList();
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const impactCounts = useMemo(() => {
    return impacts.reduce<Record<string, number>>((acc, impact) => {
      acc[impact.impacted_type] = (acc[impact.impacted_type] || 0) + 1;
      return acc;
    }, {});
  }, [impacts]);

  async function loadReviewList() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/radar-policy-updates/review-list?limit=50",
        { cache: "no-store" },
      );
      const data = await readJsonResponse<{ updates: RadarPolicyUpdateSummary[] }>(
        response,
      );
      setUpdates(data.updates);
      setSelectedId((current) => current || data.updates[0]?.id || null);
      if (!data.updates.length) {
        setDetail(null);
        setImpactJson(emptyPolicyJson);
        setRawJson(JSON.stringify(emptyPolicyJson, null, 2));
        setImpacts([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(id: number) {
    setIsLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/radar-policy-updates/${id}`, {
        cache: "no-store",
      });
      const data = await readJsonResponse<{ update: RadarPolicyUpdateDetail }>(
        response,
      );
      const json = normalizePolicyJson(data.update.impact_json);
      setDetail(data.update);
      setImpactJson(json);
      setRawJson(JSON.stringify(json, null, 2));
      setImpacts([]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function previewImpacts(nextJson: PolicyJson = impactJson) {
    if (!detail) {
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/radar-policy-updates/${detail.id}/preview-impacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ impact_json: nextJson }),
        },
      );
      const data = await readJsonResponse<{
        impacts: RadarImpactRow[];
        count: number;
      }>(response);
      setImpacts(data.impacts);
      setMessage(`Preview generated ${data.count} impact rows.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function approvePolicy() {
    if (!detail) {
      return;
    }

    const confirmed = window.confirm(
      `Approve policy update #${detail.id} and write impacts?`,
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/radar-policy-updates/${detail.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ impact_json: impactJson }),
        },
      );
      const data = await readJsonResponse<{
        impacts: RadarImpactRow[];
        count: number;
      }>(response);
      setImpacts(data.impacts);
      setMessage(`Approved and wrote ${data.count} impact rows.`);
      await loadReviewList();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function updateJson(nextJson: PolicyJson) {
    setImpactJson(nextJson);
    setRawJson(JSON.stringify(nextJson, null, 2));
    setImpacts([]);
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(rawJson) as JsonValue;
      const normalized = normalizePolicyJson(parsed);
      updateJson(normalized);
      setMode("structured");
      setMessage("Raw JSON applied.");
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const htsModifications = asArray(impactJson.hts_modifications);
  const measures = asArray(impactJson.measures);
  const scopeSets = asArray(impactJson.scope_sets);

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Policy Queue</h2>
            <p className="text-sm text-slate-600">
              confirm_needed + succeeded
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReviewList()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-slate-700 transition hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {updates.map((update) => (
            <button
              type="button"
              key={update.id}
              onClick={() => setSelectedId(update.id)}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition",
                selectedId === update.id
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-black/10 bg-white text-slate-900 hover:border-slate-400",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                  #{update.id}
                </span>
                <span className="rounded-full bg-black/10 px-2.5 py-1 text-xs font-semibold">
                  {update.source_label}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm font-semibold">
                {update.headline || update.source_title}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label="Measures" value={update.measures_count} />
                <Metric label="Scopes" value={update.scope_sets_count} />
                <Metric label="Mods" value={update.hts_modifications_count} />
              </div>
            </button>
          ))}
          {!updates.length && !isLoading ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              No policy updates need review.
            </p>
          ) : null}
        </div>
      </section>

      <main className="min-w-0 space-y-5">
        <Feedback
          isLoading={isLoading || isSaving}
          message={message}
          error={error}
        />

        {detail ? (
          <>
            <section className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Policy update #{detail.id}
                  </p>
                  <h1 className="mt-2 text-2xl font-black text-slate-950">
                    {detail.headline || detail.source_title}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <StatusPill>{detail.policy_review_status}</StatusPill>
                    <StatusPill>{detail.policy_extract_status}</StatusPill>
                    {detail.effective_date ? (
                      <StatusPill>Effective {detail.effective_date}</StatusPill>
                    ) : null}
                    {detail.published_at ? (
                      <StatusPill>
                        Published {detail.published_at.slice(0, 10)}
                      </StatusPill>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={detail.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Source
                  </a>
                  <button
                    type="button"
                    onClick={() => void previewImpacts()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    <FileJson className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => void approvePolicy()}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white/85 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-black/10 p-4">
                <ModeButton
                  active={mode === "structured"}
                  onClick={() => setMode("structured")}
                >
                  Structured Editor
                </ModeButton>
                <ModeButton active={mode === "raw"} onClick={() => setMode("raw")}>
                  Raw JSON
                </ModeButton>
              </div>

              {mode === "structured" ? (
                <div className="space-y-6 p-4">
                  <HtsModificationEditor
                    items={htsModifications}
                    onChange={(items) =>
                      updateJson({ ...impactJson, hts_modifications: items })
                    }
                  />
                  <MeasureEditor
                    items={measures}
                    onChange={(items) =>
                      updateJson({ ...impactJson, measures: items })
                    }
                  />
                  <ScopeSetEditor
                    items={scopeSets}
                    onChange={(items) =>
                      updateJson({ ...impactJson, scope_sets: items })
                    }
                  />
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <textarea
                    value={rawJson}
                    onChange={(event) => setRawJson(event.target.value)}
                    spellCheck={false}
                    className="min-h-[560px] w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={applyRawJson}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Apply JSON
                  </button>
                </div>
              )}
            </section>

            <ImpactPreview impacts={impacts} counts={impactCounts} />
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
            Select a policy update to review.
          </section>
        )}
      </main>
    </div>
  );
}

function HtsModificationEditor({
  items,
  onChange,
}: {
  items: JsonArrayItem[];
  onChange: (items: JsonArrayItem[]) => void;
}) {
  return (
    <EditorSection
      title="HTS Modifications"
      actionLabel="Add modification"
      onAdd={() =>
        onChange([...items, { note: null, action: "replace", deleted: [], inserted: [] }])
      }
    >
      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-[120px_1fr_auto]">
            <TextInput
              label="Note"
              value={stringifyNullable(item.note)}
              onChange={(value) =>
                updateArrayItem(items, index, { ...item, note: parseNullable(value) }, onChange)
              }
            />
            <TextInput
              label="Action"
              value={String(item.action || "")}
              onChange={(value) =>
                updateArrayItem(items, index, { ...item, action: value }, onChange)
              }
            />
            <DeleteButton
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ListInput
              label="Deleted"
              value={asStringArray(item.deleted)}
              onChange={(value) =>
                updateArrayItem(items, index, { ...item, deleted: value }, onChange)
              }
            />
            <ListInput
              label="Inserted"
              value={asStringArray(item.inserted)}
              onChange={(value) =>
                updateArrayItem(items, index, { ...item, inserted: value }, onChange)
              }
            />
          </div>
        </div>
      ))}
    </EditorSection>
  );
}

function MeasureEditor({
  items,
  onChange,
}: {
  items: JsonArrayItem[];
  onChange: (items: JsonArrayItem[]) => void;
}) {
  return (
    <EditorSection
      title="Measures"
      actionLabel="Add measure"
      onAdd={() =>
        onChange([
          ...items,
          {
            heading: "",
            change_type: [],
            description: "",
            country_iso2: null,
            effective_start_date: "",
          },
        ])
      }
    >
      {items.map((item, index) => {
        const heading = String(
          item.heading || item.hts_number || item.measure_heading || "",
        );
        const changeTypes = asStringArray(
          Array.isArray(item.change_type)
            ? item.change_type
            : item.change_type
              ? [item.change_type]
              : [],
        );

        return (
          <details
            key={index}
            className="rounded-2xl border border-slate-200 p-4"
            open={index < 2}
          >
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              {heading || `Measure ${index + 1}`}
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_140px_160px_auto]">
                <TextInput
                  label="Heading"
                  value={heading}
                  onChange={(value) =>
                    updateArrayItem(items, index, { ...item, heading: value }, onChange)
                  }
                />
                <TextInput
                  label="COO"
                  value={stringifyNullable(item.country_iso2)}
                  onChange={(value) =>
                    updateArrayItem(
                      items,
                      index,
                      { ...item, country_iso2: parseNullable(value) },
                      onChange,
                    )
                  }
                />
                <TextInput
                  label="Effective"
                  value={String(item.effective_start_date || "")}
                  onChange={(value) =>
                    updateArrayItem(
                      items,
                      index,
                      { ...item, effective_start_date: value },
                      onChange,
                    )
                  }
                />
                <DeleteButton
                  onClick={() =>
                    onChange(items.filter((_, itemIndex) => itemIndex !== index))
                  }
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  1-98 change type
                </p>
                <div className="flex flex-wrap gap-2">
                  {["desc_changed", "rate_changed"].map((changeType) => {
                    const active = changeTypes.includes(changeType);
                    return (
                      <button
                        key={changeType}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? changeTypes.filter((value) => value !== changeType)
                            : [...changeTypes, changeType];
                          updateArrayItem(
                            items,
                            index,
                            {
                              ...item,
                              change_type:
                                next.length === 1 ? next[0] : next.length ? next : [],
                            },
                            onChange,
                          );
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold",
                          active
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-300 bg-white text-slate-700",
                        )}
                      >
                        {changeType}
                      </button>
                    );
                  })}
                </div>
              </div>

              <TextAreaInput
                label="Description"
                value={String(item.description || "")}
                onChange={(value) =>
                  updateArrayItem(items, index, { ...item, description: value }, onChange)
                }
              />

              <div className="grid gap-3 md:grid-cols-2">
                <ListInput
                  label="Affected scope refs"
                  value={asStringArray(item.affected_scope_refs)}
                  onChange={(value) =>
                    updateArrayItem(
                      items,
                      index,
                      { ...item, affected_scope_refs: value },
                      onChange,
                    )
                  }
                />
                <ListInput
                  label="Includes headings"
                  value={asStringArray(item.includes_headings)}
                  onChange={(value) =>
                    updateArrayItem(
                      items,
                      index,
                      { ...item, includes_headings: value },
                      onChange,
                    )
                  }
                />
              </div>
            </div>
          </details>
        );
      })}
    </EditorSection>
  );
}

function ScopeSetEditor({
  items,
  onChange,
}: {
  items: JsonArrayItem[];
  onChange: (items: JsonArrayItem[]) => void;
}) {
  return (
    <EditorSection
      title="Scope Sets"
      actionLabel="Add scope"
      onAdd={() => onChange([...items, { id: "", label: "", headings: [] }])}
    >
      {items.map((item, index) => (
        <details key={index} className="rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">
            {String(item.id || item.label || `Scope ${index + 1}`)}
          </summary>
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <TextInput
                label="ID"
                value={String(item.id || "")}
                onChange={(value) =>
                  updateArrayItem(items, index, { ...item, id: value }, onChange)
                }
              />
              <TextInput
                label="Label"
                value={String(item.label || "")}
                onChange={(value) =>
                  updateArrayItem(items, index, { ...item, label: value }, onChange)
                }
              />
              <DeleteButton
                onClick={() =>
                  onChange(items.filter((_, itemIndex) => itemIndex !== index))
                }
              />
            </div>
            <ListInput
              label="Headings"
              value={asStringArray(item.headings)}
              onChange={(value) =>
                updateArrayItem(items, index, { ...item, headings: value }, onChange)
              }
            />
          </div>
        </details>
      ))}
    </EditorSection>
  );
}

function ImpactPreview({
  impacts,
  counts,
}: {
  impacts: RadarImpactRow[];
  counts: Record<string, number>;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Impact Preview</h2>
          <p className="text-sm text-slate-600">
            Rows generated for radar_policy_impacts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {Object.entries(counts).map(([type, count]) => (
            <StatusPill key={type}>
              {type}: {count}
            </StatusPill>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="px-3 py-2">HTS</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Effective</th>
              <th className="px-3 py-2">COO</th>
              <th className="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {impacts.map((impact, index) => (
              <tr key={`${impact.hts_number}-${impact.impacted_type}-${index}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-950">
                  {impact.hts_number}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {impact.impacted_type}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {impact.effective_time || "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {impact.coos?.join(", ") || "global"}
                </td>
                <td className="min-w-[280px] px-3 py-2 text-slate-600">
                  {impact.row_desc || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!impacts.length ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Click Preview to generate impact rows.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function EditorSection({
  title,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-amber-400"
      />
    </label>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400"
      />
    </label>
  );
}

function ListInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <TextAreaInput
      label={label}
      value={value.join("\n")}
      onChange={(nextValue) => onChange(parseList(nextValue))}
    />
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-slate-950 text-white"
          : "border border-black/10 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-xl bg-black/5 px-2 py-1">
      <span className="block font-bold">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}

function Feedback({
  isLoading,
  message,
  error,
}: {
  isLoading: boolean;
  message: string | null;
  error: string | null;
}) {
  if (!isLoading && !message && !error) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium",
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-sky-200 bg-sky-50 text-sky-800",
      )}
    >
      {isLoading ? (
        <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin" />
      ) : error ? null : (
        <CheckCircle2 className="mt-0.5 h-4 w-4" />
      )}
      <span>{error || message || "Loading..."}</span>
    </div>
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & {
    detail?: string | { message?: string };
    error?: string;
  };
  if (!response.ok) {
    const detailMessage =
      typeof data.detail === "string" ? data.detail : data.detail?.message;
    throw new Error(
      data.error || detailMessage || `Request failed with ${response.status}`,
    );
  }
  return data;
}

function normalizePolicyJson(value: JsonValue | null): PolicyJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...emptyPolicyJson };
  }
  return {
    ...emptyPolicyJson,
    ...(value as PolicyJson),
    hts_modifications: asArray((value as PolicyJson).hts_modifications),
    measures: asArray((value as PolicyJson).measures),
    scope_sets: asArray((value as PolicyJson).scope_sets),
  };
}

function updateArrayItem(
  items: JsonArrayItem[],
  index: number,
  nextItem: JsonArrayItem,
  onChange: (items: JsonArrayItem[]) => void,
) {
  onChange(items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
}

function asArray(value: unknown): JsonArrayItem[] {
  return Array.isArray(value)
    ? value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as JsonArrayItem)
          : {},
      )
    : [];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string | number => ["string", "number"].includes(typeof item))
    .map(String);
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyNullable(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function parseNullable(value: string): string | number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") {
    return null;
  }
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
