import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ product_code: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { product_code } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/billing/products/${encodeURIComponent(product_code)}/sync-stripe`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
