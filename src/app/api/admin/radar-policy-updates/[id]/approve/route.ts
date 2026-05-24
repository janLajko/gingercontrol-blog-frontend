import { proxyToFastApi } from "@/app/api/cms/_lib";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  return proxyToFastApi(
    `/api/admin/radar-policy-updates/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
