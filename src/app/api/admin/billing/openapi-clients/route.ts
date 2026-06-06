import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query
    ? `/api/admin/billing/openapi-clients?${query}`
    : "/api/admin/billing/openapi-clients";

  return proxyToFastApi(path, { method: "GET" });
}
