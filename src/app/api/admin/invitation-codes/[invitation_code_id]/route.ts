import { NextRequest } from "next/server";

import { proxyToFastApi } from "@/app/api/cms/_lib";

interface RouteContext {
  params: Promise<{ invitation_code_id: string }>;
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { invitation_code_id } = await context.params;

  return proxyToFastApi(
    `/api/admin/invitation-codes/${encodeURIComponent(invitation_code_id)}`,
    { method: "GET" },
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { invitation_code_id } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/invitation-codes/${encodeURIComponent(invitation_code_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { invitation_code_id } = await context.params;

  return proxyToFastApi(
    `/api/admin/invitation-codes/${encodeURIComponent(invitation_code_id)}`,
    { method: "DELETE" },
  );
}
