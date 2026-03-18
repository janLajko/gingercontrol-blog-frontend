"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, RefreshCcw } from "lucide-react";

import type { CmsArticle } from "@/types/blog";

export default function ArticlesTable() {
  const [articles, setArticles] = useState<CmsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadArticles() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/cms/articles", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load articles");
      }
      const data = (await response.json()) as CmsArticle[];
      setArticles(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load articles",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles();
  }, []);

  return (
    <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-black/8 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Article library
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Edit generated drafts, publish reviewed content, or create articles
            manually.
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-950/[0.03] text-xs uppercase tracking-[0.22em] text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Article</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Score</th>
                <th className="px-6 py-4 font-semibold">Updated</th>
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
                    <p className="mt-1 text-sm text-slate-500">{article.slug}</p>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    {article.category || "Unassigned"}
                  </td>
                  <td className="px-6 py-5">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {normalizeStatus(article.status).replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                    {article.final_score?.toFixed(1) ?? "0.0"}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-500">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(article.updated_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
