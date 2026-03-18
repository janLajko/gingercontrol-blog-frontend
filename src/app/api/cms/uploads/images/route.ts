import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const API_KEY = process.env.FASTAPI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const file = incoming.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 },
      );
    }

    const formData = new FormData();
    formData.append("file", file, file.name);

    const headers = new Headers();
    if (API_KEY) {
      headers.set("Authorization", `Bearer ${API_KEY}`);
    }

    const response = await fetch(`${FASTAPI_BASE_URL}/api/v1/uploads/images`, {
      method: "POST",
      headers,
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text();
    return NextResponse.json(
      { error: text || "Image upload failed" },
      { status: response.status || 500 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Image upload request failed",
      },
      { status: 500 },
    );
  }
}
