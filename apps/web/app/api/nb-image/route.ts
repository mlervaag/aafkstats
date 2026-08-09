import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_NB_IMAGE_TYPES, parseNbImageUrl, readImageLimited } from "@/lib/nb-image";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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
    // SVG og andre aktive dokumentformater skal aldri serveres fra vår origin.
    // Ruten er en rasterproxy, ikke en generell filproxy.
    if (!contentType || !ALLOWED_NB_IMAGE_TYPES.has(contentType)) {
      return new NextResponse("Ugyldig bildesvar", { status: 502 });
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return new NextResponse("Bildet er for stort", { status: 413 });
    }

    const image = await readImageLimited(response.body, MAX_IMAGE_BYTES);
    if (image === null) {
      return new NextResponse("Bildet er for stort", { status: 413 });
    }

    return new NextResponse(image, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        // Hvis en nettleser navigerer direkte til proxy-URL-en, skal innholdet
        // fortsatt behandles som en inert fil uten skript- eller nettverkstilgang.
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Kunne ikke hente bildet", { status: 502 });
  }
}
