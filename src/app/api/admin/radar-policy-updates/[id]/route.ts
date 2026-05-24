import { proxyToFastApi } from "@/app/api/cms/_lib";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;

  return proxyToFastApi(
    `/api/admin/radar-policy-updates/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
}
