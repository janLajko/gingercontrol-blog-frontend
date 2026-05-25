import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ invitation_code_id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { invitation_code_id } = await context.params;
  const query = request.nextUrl.searchParams.toString();
  const path = query
    ? `/api/admin/invitation-codes/${encodeURIComponent(invitation_code_id)}/usages?${query}`
    : `/api/admin/invitation-codes/${encodeURIComponent(invitation_code_id)}/usages`;

  return proxyToFastApi(path, { method: "GET" });
}
