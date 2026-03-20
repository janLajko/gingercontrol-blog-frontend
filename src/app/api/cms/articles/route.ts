import { NextRequest } from "next/server";

import { proxyToFastApi } from "../_lib";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/api/v1/articles?${query}` : "/api/v1/articles";
  return proxyToFastApi(path, { method: "GET" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToFastApi("/api/v1/articles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
