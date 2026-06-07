import { NextRequest } from "next/server";

import { proxyToFastApi } from "../../../_lib";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  return proxyToFastApi(`/api/v1/article-chat/jobs/${jobId}`, {
    method: "GET",
  });
}
