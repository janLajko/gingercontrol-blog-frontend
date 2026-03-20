"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PlusCircle, RefreshCcw } from "lucide-react";

import type { CmsArticleSummary, PaginatedCmsArticlesResponse } from "@/types/blog";

const PAGE_LIMIT = 20;

export default function ArticlesTable() {
  const [articles, setArticles] = useState<CmsArticleSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadArticles(targetPage = page) {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams({
        page: String(targetPage),
        page_limit: String(PAGE_LIMIT),
      });

      const response = await fetch(`/api/cms/articles?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load articles");
      }

      const data = (await response.json()) as PaginatedCmsArticlesResponse;
      setArticles(data.articles);
      setPage(data.page);
      setTotalPages(data.total_pages);
      setTotalCount(data.total_count);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load articles",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles(1);
  }, []);

  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-black/8 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Article library
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Browse saved articles and jump directly into the editor.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void loadArticles()}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/cms/articles/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <PlusCircle className="h-4 w-4" />
            New Article
          </Link>
        </div>
      </div>

      {error ? (
        <div className="px-6 py-8 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <div className="px-6 py-8 text-sm text-slate-500">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="px-6 py-10 text-sm text-slate-600">
          No saved articles yet.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-950/[0.03] text-xs uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Article</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Author</th>
                  <th className="px-6 py-4 font-semibold">Score</th>
                  <th className="px-6 py-4 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {articles.map((article) => (
                  <tr key={article.id} className="transition hover:bg-black/[0.02]">
                    <td className="px-6 py-5">
                      <Link
                        href={`/cms/articles/${article.id}`}
                        className="block font-semibold text-slate-950 hover:text-slate-700"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {article.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{article.slug}</p>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      {article.category || "Unassigned"}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      {article.author_name || "Unknown"}
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                      {article.final_score?.toFixed(1) ?? "0.0"}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {formatDate(article.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/8 px-6 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Page {page} of {Math.max(totalPages, 1)}. {totalCount} articles total.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => void loadArticles(page - 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={loading || totalPages === 0 || page >= totalPages}
                onClick={() => void loadArticles(page + 1)}
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
