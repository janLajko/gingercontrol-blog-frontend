import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ purchase_id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { purchase_id } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/billing/manual-purchases/${encodeURIComponent(purchase_id)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
