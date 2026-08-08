import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Basic security check to ensure we only proxy nb.no images
  if (!url.startsWith("https://www.nb.no/")) {
    return new NextResponse("Invalid url domain", { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        // nb.no might require some headers to serve the image, but usually standard fetch is fine.
        "User-Agent": "AaFK-arkivet Proxy/1.0",
        "Accept": "image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=31536000",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
