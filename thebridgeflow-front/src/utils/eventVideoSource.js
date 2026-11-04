import { resolveDriveUrl } from "../constants/videoUrls.js";

export function getEventVideoSource(url) {
  try {
    const parsed = new URL(url);
    const youtubeId = parsed.hostname.includes("youtu.be")
      ? parsed.pathname.slice(1)
      : parsed.hostname.includes("youtube.com")
        ? parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1)
        : null;
    if (youtubeId) {
      return { type: "embed", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}` };
    }

    if (parsed.hostname === "vimeo.com" || parsed.hostname === "www.vimeo.com") {
      const vimeoId = parsed.pathname.split("/").filter(Boolean).at(-1);
      if (vimeoId) return { type: "embed", src: `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}` };
    }

    if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(url)) return { type: "video", src: url };
    return { type: "embed", src: resolveDriveUrl(url, "video") };
  } catch {
    return { type: "embed", src: url };
  }
}
