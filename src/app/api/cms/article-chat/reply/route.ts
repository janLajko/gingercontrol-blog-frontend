import { NextRequest } from "next/server";

import { proxyToFastApi } from "../../_lib";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyToFastApi("/api/v1/article-chat/reply", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(60_000),
  });
}
