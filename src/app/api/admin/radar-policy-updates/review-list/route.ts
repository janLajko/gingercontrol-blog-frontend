import { type NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query
    ? `/api/admin/radar-policy-updates/review-list?${query}`
    : "/api/admin/radar-policy-updates/review-list";

  return proxyToFastApi(path, { method: "GET" });
}
