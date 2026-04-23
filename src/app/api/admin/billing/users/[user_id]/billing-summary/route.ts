import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ user_id: string }>;
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { user_id } = await context.params;

  return proxyToFastApi(
    `/api/admin/billing/users/${encodeURIComponent(user_id)}/billing-summary`,
    {
      method: "GET",
    },
  );
}
