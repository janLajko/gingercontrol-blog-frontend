import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ product_code: string }>;
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { product_code } = await context.params;

  return proxyToFastApi(
    `/api/admin/billing/products/${encodeURIComponent(product_code)}`,
    {
      method: "GET",
    },
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { product_code } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/billing/products/${encodeURIComponent(product_code)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { product_code } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/billing/products/${encodeURIComponent(product_code)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}
