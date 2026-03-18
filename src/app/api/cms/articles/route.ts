import { NextRequest } from "next/server";

import { proxyToFastApi } from "../_lib";

export async function GET() {
  return proxyToFastApi("/api/v1/articles", { method: "GET" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToFastApi("/api/v1/articles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
