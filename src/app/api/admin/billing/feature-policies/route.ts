import { proxyToFastApi } from "@/app/api/cms/_lib";

export async function GET() {
  return proxyToFastApi("/api/admin/billing/feature-policies", {
    method: "GET",
  });
}
