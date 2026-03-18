import { NextResponse } from "next/server";

const FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const API_KEY = process.env.FASTAPI_API_KEY;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export async function proxyToFastApi(
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (API_KEY && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${API_KEY}`);
  }

  const response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as JsonValue;
    return NextResponse.json(data, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: text
      ? { "Content-Type": "text/plain; charset=utf-8" }
      : undefined,
  });
}
