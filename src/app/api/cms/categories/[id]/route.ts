import { NextRequest } from "next/server";

import { proxyToFastApi } from "../../_lib";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToFastApi(`/api/v1/categories/${id}`, { method: "GET" });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  return proxyToFastApi(`/api/v1/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToFastApi(`/api/v1/categories/${id}`, { method: "DELETE" });
}
