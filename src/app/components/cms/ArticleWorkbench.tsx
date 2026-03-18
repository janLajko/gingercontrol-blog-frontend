"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  ImageUp,
  LoaderCircle,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";

import type {
  BlogCustomization,
  BlogGenerationRequest,
  BlogGenerationResponse,
  CmsArticle,
  CmsArticlePayload,
  CmsCategory,
  CmsImageUploadResponse,
} from "@/types/blog";

type ArticleStatus = "draft" | "pending_review" | "published";

interface ArticleWorkbenchProps {
  mode: "create" | "edit";
  articleId?: number;
}

interface GenerationFormState {
  keyword: string;
  max_attempts: number;
  seo_threshold: number;
  priority: "low" | "normal" | "high";
  user_id: string;
  callback_url: string;
  authorName: string;
  authorAvatar: string;
  category: string;
  coverImage: string;
  customization: Required<BlogCustomization>;
}

const defaultCustomization: Required<BlogCustomization> = {
  tone: "professional",
  target_audience: "general",
  content_type: "guide",
  word_count_target: 1500,
  include_faq: true,
  include_conclusion: true,
  include_table_of_contents: true,
  focus_keywords: [],
  exclude_domains: [],
};

const defaultGenerationForm: GenerationFormState = {
  keyword: "",
  max_attempts: 1,
  seo_threshold: 75,
  priority: "normal",
  user_id: "cms-user",
  callback_url: "",
  authorName: "",
  authorAvatar: "",
  category: "",
  coverImage: "",
  customization: defaultCustomization,
};

const defaultArticlePayload: CmsArticlePayload = {
  run_id: "",
  keyword: "",
  slug: "",
  title: "",
  description: "",
  tags: [],
  body: "",
  authorName: "",
  authorAvatar: "",
  category: "",
  coverImage: "",
  user_id: "cms-user",
  status: "draft",
  success: true,
  sources_used: [],
  source_details: [],
  seo_scores: {},
  final_score: 0,
  model_used: "",
  customization: {},
  error_message: null,
};

export default function ArticleWorkbench({
  mode,
  articleId,
}: ArticleWorkbenchProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [categories, setCategories] = useState<CmsCategory[]>([]);
  const [generationForm, setGenerationForm] = useState<GenerationFormState>(
    defaultGenerationForm,
  );
  const [tagInput, setTagInput] = useState("");
  const [focusKeywordsInput, setFocusKeywordsInput] = useState("");
  const [excludeDomainsInput, setExcludeDomainsInput] = useState("");
  const [article, setArticle] =
    useState<CmsArticlePayload>(defaultArticlePayload);
  const [savedArticleId, setSavedArticleId] = useState<number | null>(
    mode === "edit" ? articleId ?? null : null,
  );
  const [loading, setLoading] = useState(mode === "edit");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingGenerationCover, setIsUploadingGenerationCover] =
    useState(false);
  const [isUploadingEditorCover, setIsUploadingEditorCover] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generationCoverInputRef = useRef<HTMLInputElement | null>(null);
  const editorCoverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(mode === "edit");

        const categoriesResponse = await fetch("/api/cms/categories", {
          cache: "no-store",
        });
        if (!categoriesResponse.ok) {
          throw new Error("Failed to load categories");
        }
        const categoryData = (await categoriesResponse.json()) as CmsCategory[];

        if (mounted) {
          setCategories(categoryData);
        }

        if (mode === "edit" && articleId) {
          const articleResponse = await fetch(`/api/cms/articles/${articleId}`, {
            cache: "no-store",
          });
          if (!articleResponse.ok) {
            throw new Error("Failed to load article");
          }
          const articleData = (await articleResponse.json()) as CmsArticle;

          if (mounted) {
            hydrateFromArticle(articleData);
          }
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load editor data",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      mounted = false;
    };
  }, [articleId, mode]);

  function hydrateFromArticle(articleData: CmsArticle) {
    setSavedArticleId(articleData.id);
    setArticle({
      run_id: articleData.run_id || "",
      keyword: articleData.keyword || "",
      slug: articleData.slug,
      title: articleData.title,
      description: articleData.description,
      tags: articleData.tags || [],
      body: articleData.body,
      authorName: articleData.authorName || "",
      authorAvatar: articleData.authorAvatar || "",
      category: articleData.category || "",
      coverImage: articleData.coverImage || "",
      user_id: articleData.user_id || "cms-user",
      status: normalizeArticleStatus(articleData.status),
      success: articleData.success ?? true,
      sources_used: articleData.sources_used || [],
      source_details: articleData.source_details || [],
      seo_scores: articleData.seo_scores || {},
      final_score: articleData.final_score || 0,
      model_used: articleData.model_used || "",
      customization: articleData.customization || {},
      error_message: articleData.error_message ?? null,
    });
    setTagInput((articleData.tags || []).join(", "));

    const customization = (articleData.customization || {}) as BlogCustomization;
    setGenerationForm((current) => ({
      ...current,
      keyword: articleData.keyword || "",
      authorName: articleData.authorName || "",
      authorAvatar: articleData.authorAvatar || "",
      category: articleData.category || "",
      coverImage: articleData.coverImage || "",
      user_id: articleData.user_id || current.user_id,
      customization: {
        ...defaultCustomization,
        ...customization,
      },
    }));
    setFocusKeywordsInput((customization.focus_keywords || []).join(", "));
    setExcludeDomainsInput((customization.exclude_domains || []).join(", "));
  }

  function updateGenerationField<K extends keyof GenerationFormState>(
    field: K,
    value: GenerationFormState[K],
  ) {
    setGenerationForm((current) => ({ ...current, [field]: value }));
  }

  function updateCustomizationField<K extends keyof Required<BlogCustomization>>(
    field: K,
    value: Required<BlogCustomization>[K],
  ) {
    setGenerationForm((current) => ({
      ...current,
      customization: {
        ...current.customization,
        [field]: value,
      },
    }));
  }

  function updateArticleField<K extends keyof CmsArticlePayload>(
    field: K,
    value: CmsArticlePayload[K],
  ) {
    setArticle((current) => ({ ...current, [field]: value }));
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating) {
      return;
    }

    setError(null);
    setMessage(null);

    const requestPayload: BlogGenerationRequest = {
      keyword: generationForm.keyword,
      max_attempts: generationForm.max_attempts,
      seo_threshold: generationForm.seo_threshold,
      priority: generationForm.priority,
      callback_url: generationForm.callback_url || undefined,
      user_id: generationForm.user_id || undefined,
      authorName: generationForm.authorName || undefined,
      authorAvatar: generationForm.authorAvatar || undefined,
      category: generationForm.category || undefined,
      coverImage: generationForm.coverImage || undefined,
      customization: {
        ...generationForm.customization,
        focus_keywords: parseCommaSeparated(focusKeywordsInput),
        exclude_domains: parseCommaSeparated(excludeDomainsInput),
      },
    };

    startTransition(() => {
      void (async () => {
        try {
          setIsGenerating(true);
          const response = await fetch("/api/blog/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string; detail?: string }
              | null;
            throw new Error(
              payload?.detail || payload?.error || "Draft generation failed",
            );
          }

          const generated = (await response.json()) as BlogGenerationResponse;
          setSavedArticleId(generated.post_id ?? null);
          setArticle({
            run_id: generated.run_id,
            keyword: generationForm.keyword,
            slug: generated.article.slug,
            title: generated.article.title,
            description: generated.article.description,
            tags: generated.article.tags,
            body: generated.article.body,
            authorName: generated.author.authorName || generationForm.authorName,
            authorAvatar:
              generated.author.authorAvatar || generationForm.authorAvatar,
            category: generated.author.category || generationForm.category,
            coverImage: generated.author.coverImage || generationForm.coverImage,
            user_id: generationForm.user_id || undefined,
            status: generated.success ? "draft" : "pending_review",
            success: generated.success,
            sources_used: generated.metadata.sources_used,
            source_details: [],
            seo_scores: generated.seo_scores,
            final_score: generated.seo_scores.final_score,
            model_used: generated.metadata.model_used,
            customization: requestPayload.customization || {},
            error_message: null,
          });
          setTagInput(generated.article.tags.join(", "));
          setMessage(
            generated.post_id
              ? "Draft generated and loaded from the saved record. You can edit it before updating."
              : "Draft generated. Review and save when ready.",
          );
        } catch (generationError) {
          setError(
            generationError instanceof Error
              ? generationError.message
              : "Draft generation failed",
          );
        } finally {
          setIsGenerating(false);
        }
      })();
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setError(null);
    setMessage(null);

    const payload: CmsArticlePayload = {
      ...article,
      keyword: article.keyword || generationForm.keyword || undefined,
      user_id: article.user_id || generationForm.user_id || undefined,
      authorName: article.authorName || generationForm.authorName || undefined,
      authorAvatar:
        article.authorAvatar || generationForm.authorAvatar || undefined,
      category: article.category || generationForm.category || undefined,
      coverImage: article.coverImage || generationForm.coverImage || undefined,
      tags: parseCommaSeparated(tagInput),
      customization: {
        ...generationForm.customization,
        focus_keywords: parseCommaSeparated(focusKeywordsInput),
        exclude_domains: parseCommaSeparated(excludeDomainsInput),
      },
    };

    startTransition(() => {
      void (async () => {
        try {
          setIsSaving(true);
          const response = await fetch(
            savedArticleId
              ? `/api/cms/articles/${savedArticleId}`
              : "/api/cms/articles",
            {
              method: savedArticleId ? "PUT" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );

          if (!response.ok) {
            const responsePayload = (await response.json().catch(() => null)) as
              | { detail?: string }
              | null;
            throw new Error(responsePayload?.detail || "Failed to save article");
          }

          const saved = (await response.json()) as CmsArticle;
          hydrateFromArticle(saved);
          setMessage("Article saved.");
          if (!savedArticleId) {
            router.replace(`/cms/articles/${saved.id}`);
          }
        } catch (saveError) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Failed to save article",
          );
        } finally {
          setIsSaving(false);
        }
      })();
    });
  }

  async function handleDelete() {
    if (!savedArticleId || isDeleting) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          setIsDeleting(true);
          const response = await fetch(`/api/cms/articles/${savedArticleId}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            throw new Error("Failed to delete article");
          }
          router.push("/cms/articles");
          router.refresh();
        } catch (deleteError) {
          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "Failed to delete article",
          );
        } finally {
          setIsDeleting(false);
        }
      })();
    });
  }

  async function uploadCoverImage(
    file: File,
    target: "generation" | "editor",
  ) {
    const setUploading =
      target === "generation"
        ? setIsUploadingGenerationCover
        : setIsUploadingEditorCover;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cms/uploads/images", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | CmsImageUploadResponse
        | { detail?: string; error?: string }
        | null;

      if (!response.ok || !payload || !("url" in payload)) {
        throw new Error(
          payload && "detail" in payload
            ? payload.detail || payload.error || "Image upload failed"
            : "Image upload failed",
        );
      }

      updateGenerationField("coverImage", payload.url);
      updateArticleField("coverImage", payload.url);
      setMessage("Image uploaded. Cover image URL updated.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Image upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverUpload(
    event: ChangeEvent<HTMLInputElement>,
    target: "generation" | "editor",
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadCoverImage(file, target);
    event.target.value = "";
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[480px_1fr]">
        <section className="rounded-[2rem] border border-black/8 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Article generator
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                {mode === "create" ? "Create from prompt" : "Regenerate brief"}
              </h2>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              grounded search
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleGenerate}>
            <Field label="Keyword">
              <input
                value={generationForm.keyword}
                onChange={(event) =>
                  updateGenerationField("keyword", event.target.value)
                }
                placeholder="US-China tariffs"
                className={inputClassName}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Author name">
                <input
                  value={generationForm.authorName}
                  onChange={(event) =>
                    updateGenerationField("authorName", event.target.value)
                  }
                  placeholder="Jane Analyst"
                  className={inputClassName}
                />
              </Field>
              <Field label="Category">
                <input
                  value={generationForm.category}
                  onChange={(event) =>
                    updateGenerationField("category", event.target.value)
                  }
                  list="cms-category-options"
                  placeholder="Trade policy"
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Author avatar URL">
                <input
                  value={generationForm.authorAvatar}
                  onChange={(event) =>
                    updateGenerationField("authorAvatar", event.target.value)
                  }
                  placeholder="https://..."
                  className={inputClassName}
                />
              </Field>
              <Field label="Cover image URL">
                <div className="space-y-3">
                  <input
                    value={generationForm.coverImage}
                    onChange={(event) => {
                      updateGenerationField("coverImage", event.target.value);
                      updateArticleField("coverImage", event.target.value);
                    }}
                    placeholder="https://..."
                    className={inputClassName}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generationCoverInputRef.current?.click()}
                      disabled={
                        isUploadingGenerationCover ||
                        isGenerating ||
                        isSaving ||
                        isDeleting
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingGenerationCover ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageUp className="h-4 w-4" />
                      )}
                      {isUploadingGenerationCover
                        ? "Uploading..."
                        : "Upload image"}
                    </button>
                    {generationForm.coverImage ? (
                      <span className="text-xs text-slate-500">
                        Uploaded URL will auto-fill here.
                      </span>
                    ) : null}
                  </div>
                  <input
                    ref={generationCoverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void handleCoverUpload(event, "generation")
                    }
                    className="hidden"
                  />
                  {generationForm.coverImage ? (
                    <img
                      src={generationForm.coverImage}
                      alt="Cover preview"
                      className="h-40 w-full rounded-2xl border border-black/8 object-cover"
                    />
                  ) : null}
                </div>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Max attempts">
                <input
                  value={generationForm.max_attempts}
                  onChange={(event) =>
                    updateGenerationField(
                      "max_attempts",
                      Number(event.target.value),
                    )
                  }
                  type="number"
                  min={1}
                  max={10}
                  className={inputClassName}
                />
              </Field>
              <Field label="SEO threshold">
                <input
                  value={generationForm.seo_threshold}
                  onChange={(event) =>
                    updateGenerationField(
                      "seo_threshold",
                      Number(event.target.value),
                    )
                  }
                  type="number"
                  min={0}
                  max={100}
                  className={inputClassName}
                />
              </Field>
              <Field label="Priority">
                <select
                  value={generationForm.priority}
                  onChange={(event) =>
                    updateGenerationField(
                      "priority",
                      event.target.value as GenerationFormState["priority"],
                    )
                  }
                  className={inputClassName}
                >
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tone">
                <select
                  value={generationForm.customization.tone}
                  onChange={(event) =>
                    updateCustomizationField(
                      "tone",
                      event.target.value as Required<BlogCustomization>["tone"],
                    )
                  }
                  className={inputClassName}
                >
                  <option value="professional">professional</option>
                  <option value="casual">casual</option>
                  <option value="technical">technical</option>
                  <option value="friendly">friendly</option>
                  <option value="authoritative">authoritative</option>
                </select>
              </Field>
              <Field label="Audience">
                <select
                  value={generationForm.customization.target_audience}
                  onChange={(event) =>
                    updateCustomizationField(
                      "target_audience",
                      event.target.value as Required<BlogCustomization>["target_audience"],
                    )
                  }
                  className={inputClassName}
                >
                  <option value="general">general</option>
                  <option value="beginners">beginners</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Content type">
                <select
                  value={generationForm.customization.content_type}
                  onChange={(event) =>
                    updateCustomizationField(
                      "content_type",
                      event.target.value as Required<BlogCustomization>["content_type"],
                    )
                  }
                  className={inputClassName}
                >
                  <option value="guide">guide</option>
                  <option value="tutorial">tutorial</option>
                  <option value="review">review</option>
                  <option value="comparison">comparison</option>
                  <option value="news">news</option>
                  <option value="opinion">opinion</option>
                </select>
              </Field>
              <Field label="Word count target">
                <input
                  value={generationForm.customization.word_count_target}
                  onChange={(event) =>
                    updateCustomizationField(
                      "word_count_target",
                      Number(event.target.value),
                    )
                  }
                  type="number"
                  min={800}
                  max={5000}
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Toggle
                label="Table of contents"
                checked={generationForm.customization.include_table_of_contents}
                onChange={(checked) =>
                  updateCustomizationField("include_table_of_contents", checked)
                }
              />
              <Toggle
                label="Include FAQ"
                checked={generationForm.customization.include_faq}
                onChange={(checked) =>
                  updateCustomizationField("include_faq", checked)
                }
              />
              <Toggle
                label="Include conclusion"
                checked={generationForm.customization.include_conclusion}
                onChange={(checked) =>
                  updateCustomizationField("include_conclusion", checked)
                }
              />
            </div>

            <Field label="Focus keywords">
              <input
                value={focusKeywordsInput}
                onChange={(event) => setFocusKeywordsInput(event.target.value)}
                placeholder="trade, tariffs"
                className={inputClassName}
              />
            </Field>

            <Field label="Exclude domains">
              <input
                value={excludeDomainsInput}
                onChange={(event) => setExcludeDomainsInput(event.target.value)}
                placeholder="example.com, news.example.com"
                className={inputClassName}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="User ID">
                <input
                  value={generationForm.user_id}
                  onChange={(event) =>
                    updateGenerationField("user_id", event.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Callback URL">
                <input
                  value={generationForm.callback_url}
                  onChange={(event) =>
                    updateGenerationField("callback_url", event.target.value)
                  }
                  placeholder="https://..."
                  className={inputClassName}
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 px-4 py-4 text-sm font-black text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:brightness-95 disabled:opacity-70"
            >
              {isGenerating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              {isGenerating ? "Generating draft..." : "Generate grounded draft"}
            </button>
          </form>
        </section>

        <form
          className="space-y-6 rounded-[2rem] border border-black/8 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur"
          onSubmit={handleSave}
        >
          <div className="flex flex-col gap-4 border-b border-black/8 pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Editor
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                Review and save article
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Generated content lands here first. Update the markdown body,
                retune metadata, then save the current article record.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {savedArticleId ? (
                <Link
                  href={`/cms/articles/${savedArticleId}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Open saved view
                </Link>
              ) : null}
              {savedArticleId ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting || isSaving || isGenerating}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={
                  isSaving ||
                  isDeleting ||
                  isGenerating ||
                  !article.title ||
                  !article.body
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving
                  ? savedArticleId
                    ? "Updating..."
                    : "Saving..."
                  : savedArticleId
                    ? "Update article"
                    : "Save article"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-sm text-slate-500">Loading editor...</div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <input
                    value={article.title}
                    onChange={(event) =>
                      updateArticleField("title", event.target.value)
                    }
                    className={inputClassName}
                    required
                  />
                </Field>
                <Field label="Slug">
                  <input
                    value={article.slug}
                    onChange={(event) =>
                      updateArticleField("slug", event.target.value)
                    }
                    className={inputClassName}
                    required
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={article.description}
                  onChange={(event) =>
                    updateArticleField("description", event.target.value)
                  }
                  rows={3}
                  className={textareaClassName}
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Tags">
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="product, introduction"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Author name">
                  <input
                    value={article.authorName || ""}
                    onChange={(event) =>
                      updateArticleField("authorName", event.target.value)
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Category">
                  <input
                    value={article.category || ""}
                    onChange={(event) =>
                      updateArticleField("category", event.target.value)
                    }
                    list="cms-category-options"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={article.status || "draft"}
                    onChange={(event) =>
                      updateArticleField(
                        "status",
                        event.target.value as CmsArticlePayload["status"],
                      )
                    }
                    className={inputClassName}
                  >
                    <option value="draft">draft</option>
                    <option value="pending_review">pending review</option>
                    <option value="published">published</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Author avatar URL">
                  <input
                    value={article.authorAvatar || ""}
                    onChange={(event) =>
                      updateArticleField("authorAvatar", event.target.value)
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Cover image URL">
                  <div className="space-y-3">
                    <input
                      value={article.coverImage || ""}
                      onChange={(event) => {
                        updateArticleField("coverImage", event.target.value);
                        updateGenerationField("coverImage", event.target.value);
                      }}
                      className={inputClassName}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => editorCoverInputRef.current?.click()}
                        disabled={
                          isUploadingEditorCover ||
                          isGenerating ||
                          isSaving ||
                          isDeleting
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUploadingEditorCover ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageUp className="h-4 w-4" />
                        )}
                        {isUploadingEditorCover ? "Uploading..." : "Upload image"}
                      </button>
                    </div>
                    <input
                      ref={editorCoverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleCoverUpload(event, "editor")}
                      className="hidden"
                    />
                    {article.coverImage ? (
                      <img
                        src={article.coverImage}
                        alt="Article cover preview"
                        className="h-40 w-full rounded-2xl border border-black/8 object-cover"
                      />
                    ) : null}
                  </div>
                </Field>
              </div>

              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                <div className="min-w-0">
                  <Field label="Markdown body">
                    <textarea
                      value={article.body}
                      onChange={(event) =>
                        updateArticleField("body", event.target.value)
                      }
                      rows={24}
                      className={`${textareaClassName} min-h-[540px] resize-y font-mono text-sm leading-7`}
                      required
                    />
                  </Field>
                </div>

                <div className="min-w-0 space-y-4">
                  <div className="rounded-[1.5rem] border border-black/8 bg-[linear-gradient(180deg,_#101828_0%,_#18212f_100%)] p-5 text-white">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                      <Bot className="h-4 w-4" />
                      Draft diagnostics
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <DiagnosticCard
                        label="Score"
                        value={(article.final_score || 0).toFixed(1)}
                      />
                      <DiagnosticCard
                        label="Sources"
                        value={String(article.sources_used?.length || 0)}
                      />
                    </div>
                    <div className="mt-4 rounded-2xl bg-white/8 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                        Model
                      </p>
                      <p className="mt-2 break-words text-sm text-white/90">
                        {article.model_used || "Manual / not set"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-black/8 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Markdown preview snapshot
                    </p>
                    <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
                      {article.title || "Untitled article"}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {article.description || "No description yet."}
                    </p>
                    <div className="mt-5 max-h-[380px] overflow-auto rounded-2xl border border-black/8 bg-white p-4">
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-700">
                        {article.body || "Markdown body will appear here."}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
      </div>

      <datalist id="cms-category-options">
        {categories.map((category) => (
          <option key={category.id} value={category.name} />
        ))}
      </datalist>
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-black/8 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-950"
      />
      <span>{label}</span>
    </label>
  );
}

function DiagnosticCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/8 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-white">
        {value}
      </p>
    </div>
  );
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeArticleStatus(status?: string): ArticleStatus {
  if (status === "published") {
    return "published";
  }
  if (status === "pending_review" || status === "failed") {
    return "pending_review";
  }
  return "draft";
}

const inputClassName =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-950";

const textareaClassName =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-950";
