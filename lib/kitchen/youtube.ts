/**
 * YouTube link handling for the Kitchen music player.
 *
 * Playback uses the IFrame Player API, which requires NO API key — we only need
 * the video or playlist id out of whatever link the user pasted. (The Data API,
 * which does need a key, is only required for in-app *search*; we deliberately
 * avoid it so music works with zero credentials.)
 */

export type YouTubeRef = { kind: "video" | "playlist"; id: string };

/**
 * Pull a video or playlist id out of any of the many YouTube URL shapes:
 *   youtube.com/watch?v=ID            youtu.be/ID
 *   music.youtube.com/watch?v=ID      youtube.com/playlist?list=ID
 *   youtube.com/embed/ID              youtube.com/shorts/ID
 *   youtube.com/live/ID               a bare id
 * A playlist wins over a video when a link carries both, because the user
 * pasting a "…&list=…" link almost always means "play this whole mix".
 */
export function parseYouTube(input: string): YouTubeRef | null {
  const raw = input.trim();
  if (!raw) return null;

  // A bare id: 11 chars for a video, or a playlist id prefix.
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return { kind: "video", id: raw };
  if (/^(PL|OLAK5uy_|RD|UU|LL|FL)[A-Za-z0-9_-]{10,}$/.test(raw)) return { kind: "playlist", id: raw };

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const isYouTube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be" ||
    host.endsWith(".youtube.com");
  if (!isYouTube) return null;

  const list = url.searchParams.get("list");
  if (list && /^[A-Za-z0-9_-]{10,}$/.test(list)) return { kind: "playlist", id: list };

  const v = url.searchParams.get("v");
  if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return { kind: "video", id: v };

  // Path-style links: youtu.be/ID, /embed/ID, /shorts/ID, /live/ID
  const seg = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be" && seg[0] && /^[A-Za-z0-9_-]{11}$/.test(seg[0])) {
    return { kind: "video", id: seg[0] };
  }
  const idx = seg.findIndex((s) => s === "embed" || s === "shorts" || s === "live" || s === "v");
  if (idx >= 0 && seg[idx + 1] && /^[A-Za-z0-9_-]{11}$/.test(seg[idx + 1])) {
    return { kind: "video", id: seg[idx + 1] };
  }
  if (seg[0] === "playlist" && list) return { kind: "playlist", id: list };

  return null;
}

/** Build the embed URL the IFrame player loads. No API key involved. */
export function embedUrl(ref: YouTubeRef, origin?: string): string {
  const p = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (origin) p.set("origin", origin);
  if (ref.kind === "playlist") {
    p.set("list", ref.id);
    p.set("listType", "playlist");
    return `https://www.youtube.com/embed/videoseries?${p.toString()}`;
  }
  return `https://www.youtube.com/embed/${ref.id}?${p.toString()}`;
}

/** Thumbnail for a video ref (playlists have no stable thumb without the API). */
export function thumbnailUrl(ref: YouTubeRef): string | null {
  return ref.kind === "video" ? `https://i.ytimg.com/vi/${ref.id}/mqdefault.jpg` : null;
}

/** A human-ish default label when the user doesn't type one. */
export function defaultLabel(ref: YouTubeRef): string {
  return ref.kind === "playlist" ? `Playlist ${ref.id.slice(0, 8)}` : `Track ${ref.id.slice(0, 6)}`;
}
