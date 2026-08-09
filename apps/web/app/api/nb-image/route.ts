import { NextRequest, NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function parseNbImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.nb.no" ||
      url.username !== "" ||
      url.password !== "" ||
      !url.pathname.startsWith("/services/image/")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const imageUrl = parseNbImageUrl(url);
  if (!imageUrl) {
    return new NextResponse("Invalid url domain", { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "AaFK-arkivet Proxy/1.0",
        Accept: "image/webp,image/avif,image/jpeg,image/png,image/*;q=0.8",
      },
    });

    if (!response.ok) {
      return new NextResponse("Kunne ikke hente bildet", { status: 502 });
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
    if (!contentType?.startsWith("image/")) {
      return new NextResponse("Ugyldig bildesvar", { status: 502 });
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return new NextResponse("Bildet er for stort", { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return new NextResponse("Bildet er for stort", { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Kunne ikke hente bildet", { status: 502 });
  }
}
