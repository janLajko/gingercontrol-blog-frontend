"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Plus,
  Image as ImageIcon,
  Video,
  Code,
  FileCode,
  LoaderCircle,
} from "lucide-react";
import type { CmsMediaUploadResponse } from "@/types/blog";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
  required?: boolean;
}

export default function MarkdownEditor({
  value,
  onChange,
  className,
  rows,
  required,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Track cursor position
  const handleSelect = useCallback(() => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart;
    }
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Insert text at cursor position
  const insertAtCursor = useCallback(
    (text: string, cursorOffset?: number) => {
      const pos = cursorPosRef.current;
      const before = value.slice(0, pos);
      const after = value.slice(pos);
      onChange(before + text + after);

      const newPos = pos + (cursorOffset ?? text.length);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newPos;
          textareaRef.current.selectionEnd = newPos;
          textareaRef.current.focus();
        }
      });
    },
    [value, onChange],
  );

  // Upload media file
  const uploadMedia = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setMenuOpen(false);

      try {
        const formData = new FormData();
        formData.append("file", file, file.name);

        const res = await fetch("/api/cms/uploads/media", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.error || "Upload failed");
        }

        const data: CmsMediaUploadResponse = await res.json();

        if (data.media_type === "image") {
          insertAtCursor(`\n![${data.filename}](${data.url})\n`);
        } else {
          insertAtCursor(
            `\n<video src="${data.url}" controls width="100%"></video>\n`,
          );
        }
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "Upload failed, please try again",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [insertAtCursor],
  );

  // Handle file selection
  const handleFileChange = useCallback(
    (type: "image" | "video") =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be selected again
        e.target.value = "";

        const maxSize = type === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
        if (file.size > maxSize) {
          const limitMB = maxSize / (1024 * 1024);
          alert(`File too large. Maximum size is ${limitMB}MB`);
          return;
        }

        uploadMedia(file);
      },
    [uploadMedia],
  );

  const handleInsertCodeBlock = useCallback(() => {
    setMenuOpen(false);
    const snippet = "\n```\n\n```\n";
    insertAtCursor(snippet, "\n```\n".length);
  }, [insertAtCursor]);

  const handleInsertHtml = useCallback(() => {
    setMenuOpen(false);
    const snippet = "\n<div>\n\n</div>\n";
    insertAtCursor(snippet, "\n<div>\n".length);
  }, [insertAtCursor]);

  const menuItems = [
    {
      icon: ImageIcon,
      label: "Upload image",
      onClick: () => imageInputRef.current?.click(),
    },
    {
      icon: Video,
      label: "Upload video",
      onClick: () => videoInputRef.current?.click(),
    },
    {
      icon: Code,
      label: "Code block",
      onClick: handleInsertCodeBlock,
    },
    {
      icon: FileCode,
      label: "HTML embed",
      onClick: handleInsertHtml,
    },
  ];

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          handleSelect();
        }}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        rows={rows}
        className={className}
        required={required}
      />

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange("image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange("video")}
      />

      {/* Floating + button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        disabled={isUploading}
        className="absolute bottom-4 left-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white shadow-md transition hover:bg-slate-50 disabled:opacity-50"
        title="Insert media"
      >
        {isUploading ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-slate-500" />
        ) : (
          <Plus
            className={`h-5 w-5 text-slate-600 transition-transform ${menuOpen ? "rotate-45" : ""}`}
          />
        )}
      </button>

      {/* Media menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-14 left-4 flex gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
