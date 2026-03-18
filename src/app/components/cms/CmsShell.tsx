"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FolderTree,
  LayoutDashboard,
  PlusCircle,
  Sparkles,
} from "lucide-react";

import { cn } from "@/app/lib/utils";

interface CmsShellProps {
  children: ReactNode;
}

const navItems = [
  { href: "/cms", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cms/articles", label: "Articles", icon: FileText },
  { href: "/cms/categories", label: "Category", icon: FolderTree },
];

export default function CmsShell({ children }: CmsShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,173,59,0.14),_transparent_35%),linear-gradient(180deg,_#f7f3ea_0%,_#f4efe7_48%,_#eee6db_100%)] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col border-r border-white/10 bg-[#171717] text-white">
          <div className="border-b border-white/10 px-8 py-10">
            <p className="text-4xl font-black tracking-tight">OptiBlogAi</p>
            <p className="mt-2 text-sm uppercase tracking-[0.35em] text-amber-200/70">
              Blog CMS
            </p>
          </div>

          <nav className="px-4 py-6">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/cms"
                    ? pathname === item.href
                    : pathname?.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition",
                        active
                          ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          : "text-white/65 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto px-6 pb-6">
            <Link
              href="/cms/articles/new"
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-105"
            >
              <PlusCircle className="h-5 w-5" />
              New Article
            </Link>
          </div>
        </aside>

        <div className="relative px-6 py-6 sm:px-8 lg:px-12">
          <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(120deg,_rgba(255,255,255,0.6),_rgba(255,255,255,0))]" />
          <div className="relative">
            <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-black/5 bg-white/65 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-900">
                  <Sparkles className="h-3.5 w-3.5" />
                  Editorial Console
                </p>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Build, edit, and publish grounded articles.
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <QuickLink href="/cms/articles">All Articles</QuickLink>
                <QuickLink href="/cms/articles/new">Generate Draft</QuickLink>
                <QuickLink href="/cms/categories">Manage Categories</QuickLink>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-black/10 bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}
