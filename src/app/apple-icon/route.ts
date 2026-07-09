import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/apple-icon.svg", request.url), 308);
}
