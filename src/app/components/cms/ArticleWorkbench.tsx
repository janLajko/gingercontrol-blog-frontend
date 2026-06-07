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
  Send,
  Save,
  Trash2,
} from "lucide-react";

import type {
  ArticleChatJobCreateResponse,
  ArticleChatJobStatusResponse,
  ArticleChatMessage,
  ArticleChatReplyResponse,
  BlogCustomization,
  CmsArticle,
  CmsArticlePayload,
  CmsCategory,
  CmsImageUploadResponse,
} from "@/types/blog";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import MarkdownEditor from "./MarkdownEditor";

type ArticleStatus = "draft" | "pending_review" | "published";

interface ArticleWorkbenchProps {
  mode: "create" | "edit";
  articleId?: number;
  articleType?: "article" | "news";
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

const ARTICLE_CHAT_JOB_POLL_INTERVAL_MS = 2000;
const ARTICLE_CHAT_JOB_TIMEOUT_MS = 120000;

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function readApiErrorMessage(
  payload: { error?: unknown; detail?: unknown } | null,
  fallback: string,
) {
  if (!payload) {
    return fallback;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (
    payload.detail &&
    typeof payload.detail === "object" &&
    "message" in payload.detail &&
    typeof payload.detail.message === "string"
  ) {
    return payload.detail.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}

function isArticleChatReplyResponse(
  payload: unknown,
): payload is ArticleChatReplyResponse {
  return (
    !!payload &&
    typeof payload === "object" &&
    "article" in payload &&
    !!payload.article &&
    typeof payload.article === "object" &&
    "slug" in payload.article &&
    "title" in payload.article &&
    "description" in payload.article &&
    "tags" in payload.article &&
    "body" in payload.article
  );
}

function isArticleChatJobCreateResponse(
  payload: unknown,
): payload is ArticleChatJobCreateResponse {
  return (
    !!payload &&
    typeof payload === "object" &&
    "job_id" in payload &&
    typeof payload.job_id === "string" &&
    payload.job_id.length > 0
  );
}

async function waitForArticleChatJob(jobId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < ARTICLE_CHAT_JOB_TIMEOUT_MS) {
    await delay(ARTICLE_CHAT_JOB_POLL_INTERVAL_MS);

    const response = await fetch(`/api/cms/article-chat/jobs/${jobId}`, {
      method: "GET",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown; detail?: unknown }
        | null;
      throw new Error(
        readApiErrorMessage(payload, "Article chat job status request failed"),
      );
    }

    const job = (await response.json()) as ArticleChatJobStatusResponse;

    if (job.status === "completed" && isArticleChatReplyResponse(job.result)) {
      return job.result;
    }

    if (job.status === "completed") {
      throw new Error("Article chat job completed without an article result.");
    }

    if (job.status === "failed") {
      throw new Error(job.error || "Article chat request failed");
    }
  }

  throw new Error("Article chat job timed out. Please try again.");
}

export default function ArticleWorkbench({
  mode,
  articleId,
  articleType = "article",
}: ArticleWorkbenchProps) {
  const isNews = articleType === "news";
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
  const [chatMessages, setChatMessages] = useState<ArticleChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [isChatSending, setIsChatSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
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

  async function handleSendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMessage = chatInput.trim();
    if (isChatSending || !nextMessage) {
      return;
    }

    setError(null);
    setMessage(null);

    const requestPayload = {
      article: article.body
        ? {
            slug: article.slug,
            title: article.title,
            description: article.description,
            tags: article.tags,
            body: article.body,
          }
        : null,
      messages: chatMessages,
      message: nextMessage,
      customization: {
        ...generationForm.customization,
        focus_keywords: parseCommaSeparated(focusKeywordsInput),
        exclude_domains: parseCommaSeparated(excludeDomainsInput),
      },
      metadata: {
        keyword: article.keyword || generationForm.keyword || undefined,
        authorName: article.authorName || generationForm.authorName || undefined,
        authorAvatar:
          article.authorAvatar || generationForm.authorAvatar || undefined,
        category: article.category || generationForm.category || undefined,
        coverImage: article.coverImage || generationForm.coverImage || undefined,
        user_id: article.user_id || generationForm.user_id || undefined,
        type: articleType,
      },
      source_details: article.source_details || [],
    };

    startTransition(() => {
      void (async () => {
        try {
          setIsChatSending(true);
          setChatMessages((current) => [
            ...current,
            { role: "user", content: nextMessage },
          ]);
          setChatInput("");

          const response = await fetch("/api/cms/article-chat/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: unknown; detail?: unknown }
              | null;
            throw new Error(
              readApiErrorMessage(payload, "Article chat request failed"),
            );
          }

          const responsePayload = (await response.json()) as unknown;
          const result = isArticleChatReplyResponse(responsePayload)
            ? responsePayload
            : isArticleChatJobCreateResponse(responsePayload)
              ? await waitForArticleChatJob(responsePayload.job_id)
              : null;

          if (!result) {
            throw new Error("Article chat response did not include a job id.");
          }

          setArticle((current) => ({
            ...current,
            keyword: current.keyword || generationForm.keyword || nextMessage,
            slug: result.article.slug,
            title: result.article.title,
            description: result.article.description,
            tags: result.article.tags,
            body: result.article.body,
            authorName: current.authorName || generationForm.authorName,
            authorAvatar: current.authorAvatar || generationForm.authorAvatar,
            category: current.category || generationForm.category,
            coverImage: current.coverImage || generationForm.coverImage,
            user_id: current.user_id || generationForm.user_id || undefined,
            status: normalizeArticleStatus(current.status),
            success: true,
            sources_used: result.metadata.sources_used || current.sources_used || [],
            source_details:
              result.metadata.source_details || current.source_details || [],
            model_used: result.metadata.model_used || current.model_used || "",
            customization: requestPayload.customization || {},
            error_message: null,
          }));
          setTagInput(result.article.tags.join(", "));
          setChatMessages((current) => [
            ...current,
            { role: "assistant", content: result.assistant_message },
          ]);
        } catch (chatError) {
          setChatMessages((current) =>
            current.filter(
              (item, index) =>
                index !== current.length - 1 ||
                item.role !== "user" ||
                item.content !== nextMessage,
            ),
          );
          setChatInput(nextMessage);
          setError(
            chatError instanceof Error
              ? chatError.message
              : "Article chat request failed",
          );
        } finally {
          setIsChatSending(false);
        }
      })();
    });
  }

  async function persistArticle(nextStatus?: ArticleStatus) {
    if (isSaving || isPublishing) {
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
      type: articleType,
      status: nextStatus || normalizeArticleStatus(article.status),
      customization: {
        ...generationForm.customization,
        focus_keywords: parseCommaSeparated(focusKeywordsInput),
        exclude_domains: parseCommaSeparated(excludeDomainsInput),
      },
    };

    startTransition(() => {
      void (async () => {
        try {
          if (nextStatus === "published") {
            setIsPublishing(true);
          } else {
            setIsSaving(true);
          }
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
          setMessage(
            nextStatus === "published" ? "Article published." : "Article saved.",
          );
          if (!savedArticleId) {
            const basePath = isNews ? "/cms/news" : "/cms/articles";
            router.replace(`${basePath}/${saved.id}`);
          }
        } catch (saveError) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Failed to save article",
          );
        } finally {
          setIsSaving(false);
          setIsPublishing(false);
        }
      })();
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistArticle();
  }

  async function handlePublish() {
    await persistArticle("published");
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

      <div className="space-y-6">
        {!isNews && (
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

          <form className="mt-6 space-y-5" onSubmit={handleSendChatMessage}>
            <div className="max-h-[360px] space-y-3 overflow-auto rounded-2xl border border-black/8 bg-slate-50 p-4">
              {chatMessages.length === 0 ? (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-500">
                  Write an article about international trade, 1,500 words...
                </div>
              ) : (
                chatMessages.map((chatMessage, index) => (
                  <div
                    key={`${chatMessage.role}-${index}`}
                    className={`flex gap-3 ${
                      chatMessage.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {chatMessage.role !== "user" ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[min(720px,85%)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                        chatMessage.role === "user"
                          ? "bg-slate-950 text-white"
                          : "border border-black/8 bg-white text-slate-700"
                      }`}
                    >
                      {chatMessage.content}
                    </div>
                  </div>
                ))
              )}
              {isChatSending ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Working...
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={
                  article.body
                    ? "Revise the second paragraph to emphasize how tariffs affect supply chains"
                    : "Write an article about international trade, 1,500 words, professional tone"
                }
                rows={3}
                className={`${textareaClassName} min-h-[96px] flex-1 resize-y`}
                required
              />
              <button
                type="submit"
                disabled={isChatSending || !chatInput.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-36"
              >
                {isChatSending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </div>

            <details className="rounded-2xl border border-black/8 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                Advanced settings
              </summary>
              <div className="mt-5 space-y-5">
                <Field label="Keyword">
                  <input
                    value={generationForm.keyword}
                    onChange={(event) =>
                      updateGenerationField("keyword", event.target.value)
                    }
                    placeholder="US-China tariffs"
                    className={inputClassName}
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

                <div className="grid gap-4 sm:grid-cols-2">
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
                      <button
                        type="button"
                        onClick={() => generationCoverInputRef.current?.click()}
                        disabled={
                          isUploadingGenerationCover ||
                          isChatSending ||
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
                        {isUploadingGenerationCover ? "Uploading..." : "Upload image"}
                      </button>
                      <input
                        ref={generationCoverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          void handleCoverUpload(event, "generation")
                        }
                        className="hidden"
                      />
                    </div>
                  </Field>
                </div>

                <Field label="User ID">
                  <input
                    value={generationForm.user_id}
                    onChange={(event) =>
                      updateGenerationField("user_id", event.target.value)
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>
            </details>
          </form>
        </section>
        )}

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
                {isNews ? "Review and save news" : "Review and save article"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {isNews
                  ? "Fill in the news content, set metadata, then save."
                  : "Generated content lands here first. Update the markdown body, retune metadata, then save the current article record."}
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
                  disabled={isDeleting || isSaving || isPublishing || isChatSending}
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
              {savedArticleId ? (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={
                    isPublishing ||
                    isSaving ||
                    isDeleting ||
                    isChatSending ||
                    !article.title ||
                    !article.body ||
                    article.status === "published"
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPublishing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isPublishing
                    ? "Publishing..."
                    : article.status === "published"
                      ? "Published"
                      : "Publish"}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={
                  isSaving ||
                  isPublishing ||
                  isDeleting ||
                  isChatSending ||
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
                          isChatSending ||
                          isSaving ||
                          isPublishing ||
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
                    <MarkdownEditor
                      value={article.body}
                      onChange={(val) => updateArticleField("body", val)}
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
                    <div className="prose prose-slate max-w-none mt-5 max-h-[380px] overflow-auto rounded-2xl border border-black/8 bg-white p-4">
                      {article.body ? (
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            img: ({ src, alt }) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt={alt || ""}
                                className="max-w-full rounded-lg"
                              />
                            ),
                          }}
                        >
                          {article.body}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-slate-400">
                          Markdown body will appear here.
                        </p>
                      )}
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
