import type { ReactNode } from "react";
import CmsShell from "../components/cms/CmsShell";

interface CmsLayoutProps {
  children: ReactNode;
}

export default function CmsLayout({ children }: CmsLayoutProps) {
  return <CmsShell>{children}</CmsShell>;
}
