import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ user_id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { user_id } = await context.params;

  return proxyToFastApi(`/api/admin/users/${encodeURIComponent(user_id)}`, {
    method: "GET",
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user_id } = await context.params;

  return proxyToFastApi(`/api/admin/users/${encodeURIComponent(user_id)}`, {
    method: "DELETE",
  });
}
