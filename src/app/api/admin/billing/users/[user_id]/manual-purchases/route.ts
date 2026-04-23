import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ user_id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { user_id } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/billing/users/${encodeURIComponent(user_id)}/manual-purchases`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
