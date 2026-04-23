import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query
    ? `/api/admin/billing/users/search?${query}`
    : "/api/admin/billing/users/search";

  return proxyToFastApi(path, { method: "GET" });
}
