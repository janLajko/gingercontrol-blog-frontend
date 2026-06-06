import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query
    ? `/api/admin/billing/openapi-keys?${query}`
    : "/api/admin/billing/openapi-keys";

  return proxyToFastApi(path, { method: "GET" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  return proxyToFastApi("/api/admin/billing/openapi-keys", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
