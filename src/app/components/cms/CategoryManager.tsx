"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

import type { CmsCategory } from "@/types/blog";

export default function CategoryManager() {
  const [categories, setCategories] = useState<CmsCategory[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/cms/categories", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load categories");
      }
      const data = (await response.json()) as CmsCategory[];
      setCategories(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load categories",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        editingId ? `/api/cms/categories/${editingId}` : "/api/cms/categories",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(payload?.detail || "Failed to save category");
      }

      setName("");
      setEditingId(null);
      setMessage(editingId ? "Category updated." : "Category created.");
      await loadCategories();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save category",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(categoryId: number) {
    try {
      setError(null);
      setMessage(null);
      const response = await fetch(`/api/cms/categories/${categoryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete category");
      }
      if (editingId === categoryId) {
        setEditingId(null);
        setName("");
      }
      setMessage("Category deleted.");
      await loadCategories();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete category",
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="rounded-[2rem] border border-black/8 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          {editingId ? "Rename category" : "Create category"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Categories stay lightweight on purpose. Articles store the category as
          a plain string, and this page manages the available options.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Category name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Trade policy"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-950"
              required
              maxLength={255}
            />
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusCircle className="h-4 w-4" />
              {submitting
                ? editingId
                  ? "Updating..."
                  : "Creating..."
                : editingId
                  ? "Update category"
                  : "Create category"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setError(null);
                  setMessage(null);
                }}
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        {message ? (
          <p className="mt-4 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-black/8 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="border-b border-black/8 px-6 py-5">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Category list
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-600">
            No categories yet.
          </div>
        ) : (
          <div className="divide-y divide-black/6">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-950">{category.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Updated{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(category.updated_at))}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(category.id);
                      setName(category.name);
                      setMessage(null);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(category.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
