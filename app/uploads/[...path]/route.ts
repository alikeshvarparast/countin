import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { contentTypeFor, resolveUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path ?? [];
  if (parts.length !== 2) {
    return new NextResponse("Not found", { status: 404 });
  }
  const [folder, filename] = parts;
  const filePath = resolveUploadPath(folder, filename);
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }
  const body = await readFile(filePath);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(filename),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
