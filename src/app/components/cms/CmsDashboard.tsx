"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FolderOpen, NotebookPen, Trophy } from "lucide-react";

import type {
  CmsArticle,
  CmsArticleSummary,
  CmsCategory,
  PaginatedCmsArticlesResponse,
} from "@/types/blog";

interface DashboardState {
  articles: CmsArticleSummary[];
  categories: CmsCategory[];
  totalArticles: number;
}

export default function CmsDashboard() {
  const [state, setState] = useState<DashboardState>({
    articles: [],
    categories: [],
    totalArticles: 0,
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

        const [articlesPayload, categories] = (await Promise.all([
          articlesResponse.json(),
          categoriesResponse.json(),
        ])) as [PaginatedCmsArticlesResponse | CmsArticle[], CmsCategory[]];

        if (mounted) {
          const { articles, totalArticles } = normalizeArticlesPayload(articlesPayload);
          setState({
            articles,
            categories,
            totalArticles,
          });
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

  const averageScore =
    state.articles.length > 0
      ? (
          state.articles.reduce(
            (sum, article) => sum + Number(article.final_score || 0),
            0,
          ) / state.articles.length
        ).toFixed(1)
      : "0.0";
  const recentArticles = state.articles.slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          label="Articles Indexed"
          value={loading ? "..." : String(state.totalArticles)}
          accent="text-emerald-600"
          icon={<NotebookPen className="h-5 w-5" />}
        />
        <MetricCard
          label="Avg Score"
          value={loading ? "..." : averageScore}
          accent="text-amber-600"
          icon={<Trophy className="h-5 w-5" />}
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
                  <CategoryPill category={article.category} />
                </div>
                <p className="text-sm text-slate-500 md:text-right">
                  {formatDate(article.created_at)}
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

function CategoryPill({ category }: { category?: string | null }) {
  return (
    <span
      className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
    >
      {category || "Unassigned"}
    </span>
  );
}

function normalizeArticlesPayload(
  payload: PaginatedCmsArticlesResponse | CmsArticle[],
): { articles: CmsArticleSummary[]; totalArticles: number } {
  if (Array.isArray(payload)) {
    return {
      articles: payload.map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
        description: article.description,
        tags: article.tags || [],
        created_at: article.created_at,
        final_score: article.final_score,
        cover_image: article.coverImage || null,
        author_name: article.authorName || null,
        author_avatar: article.authorAvatar || null,
        category: article.category || null,
      })),
      totalArticles: payload.length,
    };
  }

  return {
    articles: payload.articles || [],
    totalArticles: payload.total_count || 0,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
