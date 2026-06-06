import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{
    key_id: string;
  }>;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { key_id } = await context.params;

  return proxyToFastApi(
    `/api/admin/billing/openapi-keys/${encodeURIComponent(key_id)}`,
    {
      method: "DELETE",
    },
  );
}
