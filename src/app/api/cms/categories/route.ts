import { NextRequest } from "next/server";

import { proxyToFastApi } from "../_lib";

export async function GET() {
  return proxyToFastApi("/api/v1/categories", { method: "GET" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToFastApi("/api/v1/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
