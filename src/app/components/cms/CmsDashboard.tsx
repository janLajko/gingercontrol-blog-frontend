"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, FileCheck2, FolderOpen } from "lucide-react";

import type { CmsArticle, CmsCategory } from "@/types/blog";

interface DashboardState {
  articles: CmsArticle[];
  categories: CmsCategory[];
}

export default function CmsDashboard() {
  const [state, setState] = useState<DashboardState>({
    articles: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [articlesResponse, categoriesResponse] = await Promise.all([
          fetch("/api/cms/articles", { cache: "no-store" }),
          fetch("/api/cms/categories", { cache: "no-store" }),
        ]);

        if (!articlesResponse.ok || !categoriesResponse.ok) {
          throw new Error("Failed to load CMS dashboard data");
        }

        const [articles, categories] = (await Promise.all([
          articlesResponse.json(),
          categoriesResponse.json(),
        ])) as [CmsArticle[], CmsCategory[]];

        if (mounted) {
          setState({ articles, categories });
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load dashboard",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const publishedCount = state.articles.filter(
    (article) => normalizeStatus(article.status) === "published",
  ).length;
  const draftCount = state.articles.filter(
    (article) => normalizeStatus(article.status) !== "published",
  ).length;
  const recentArticles = state.articles.slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          label="Published Articles"
          value={loading ? "..." : String(publishedCount)}
          accent="text-emerald-600"
          icon={<FileCheck2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Draft Queue"
          value={loading ? "..." : String(draftCount)}
          accent="text-amber-600"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Category Library"
          value={loading ? "..." : String(state.categories.length)}
          accent="text-sky-600"
          icon={<FolderOpen className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-black/8 px-6 py-5">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Recent articles
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Review generated drafts and jump directly into the editor.
            </p>
          </div>
          <Link
            href="/cms/articles"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error ? (
          <div className="px-6 py-8 text-sm text-red-600">{error}</div>
        ) : recentArticles.length === 0 && !loading ? (
          <div className="px-6 py-10 text-sm text-slate-600">
            No articles yet. Generate your first draft from the article module.
          </div>
        ) : (
          <div className="divide-y divide-black/6">
            {recentArticles.map((article) => (
              <Link
                key={article.id}
                href={`/cms/articles/${article.id}`}
                className="grid gap-3 px-6 py-5 transition hover:bg-black/[0.02] md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    {article.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {article.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={normalizeStatus(article.status)} />
                  <SourcePill success={article.success ?? false} />
                </div>
                <p className="text-sm text-slate-500 md:text-right">
                  {formatDate(article.updated_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-black/8 bg-white/75 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          {label}
        </p>
        <div className="rounded-full bg-slate-950/5 p-3 text-slate-700">
          {icon}
        </div>
      </div>
      <p className={`mt-8 text-5xl font-black tracking-tight ${accent}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "published"
      ? "bg-emerald-100 text-emerald-800"
      : normalized === "pending_review"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {normalized.replace("_", " ")}
    </span>
  );
}

function normalizeStatus(status?: string) {
  if (status === "published") {
    return "published";
  }
  if (status === "pending_review" || status === "failed") {
    return "pending_review";
  }
  return "draft";
}

function SourcePill({ success }: { success: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        success ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700"
      }`}
    >
      {success ? "AI" : "Needs review"}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
