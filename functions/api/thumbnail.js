// functions/api/thumbnail.js

export async function onRequestGet(context) {
  const url = new URL(context.request.url).searchParams.get("url");
  if (!url) {
    return Response.json(
      { success: false, error: "Missing url" },
      { status: 400 },
    );
  }

  // 1. Try OpenGraph scrape
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NoraBot/1.0; +https://nora.pages.dev)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    const html = await res.text();

    // Look for og:image or twitter:image
    const patterns = [
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return Response.json({
          success: true,
          thumbnail: match[1],
          source: "opengraph",
        });
      }
    }
  } catch (e) {
    // continue to fallbacks
  }

  // 2. TikTok oEmbed fallback
  if (url.includes("tiktok.com")) {
    try {
      const oembed = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      );
      if (oembed.ok) {
        const data = await oembed.json();
        if (data.thumbnail_url) {
          return Response.json({
            success: true,
            thumbnail: data.thumbnail_url,
            source: "tiktok-oembed",
          });
        }
      }
    } catch (e) {}
  }

  // 3. YouTube — extract video ID and use their thumbnail service
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const idMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (idMatch) {
      return Response.json({
        success: true,
        thumbnail: `https://img.youtube.com/vi/${idMatch[1]}/maxresdefault.jpg`,
        source: "youtube",
      });
    }
  }

  // 4. Instagram — public oEmbed is unreliable, so fail gracefully
  if (url.includes("instagram.com")) {
    return Response.json(
      {
        success: false,
        error:
          "Instagram thumbnails require manual upload or a Meta app token.",
      },
      { status: 404 },
    );
  }

  // 5. Nothing worked
  return Response.json(
    {
      success: false,
      error: "Could not extract thumbnail. Please upload manually.",
    },
    { status: 404 },
  );
}
