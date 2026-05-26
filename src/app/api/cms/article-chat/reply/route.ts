import { NextRequest } from "next/server";

import { proxyToFastApi } from "../../_lib";

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyToFastApi("/api/v1/article-chat/reply", {
    method: "POST",
    body,
  });
}
