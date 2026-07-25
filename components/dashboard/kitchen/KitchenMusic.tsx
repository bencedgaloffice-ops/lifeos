"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { Music, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Plus, Trash2, Radio } from "lucide-react";
import type { MusicStation } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, EmptyState, inputClass } from "@/components/dashboard/ui";
import { parseYouTube, embedUrl, thumbnailUrl, defaultLabel, type YouTubeRef } from "@/lib/kitchen/youtube";
import { addMusicStation, deleteMusicStation } from "@/app/dashboard/kitchen/actions";
import { cn } from "@/lib/utils";

/* The bits of the YouTube IFrame API we actually use. */
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  setVolume: (v: number) => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
  getPlayerState: () => number;
};
type YTNamespace = {
  Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Load the IFrame Player API once. It needs no API key. */
function loadYouTubeAPI(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const existing = document.getElementById("yt-iframe-api");
    const done = () => window.YT?.Player && resolve(window.YT);
    if (!existing) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      done();
    };
    // In case the script was already loaded and the callback has fired.
    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll);
        resolve(window.YT);
      }
    }, 200);
    setTimeout(() => clearInterval(poll), 15000);
  });
}

/**
 * Kitchen music — YouTube / YouTube Music, no API key required.
 *
 * Paste any YouTube or YouTube Music link (track, mix or playlist) and it
 * plays here with real transport controls, driven by the official IFrame
 * Player API. Stations are saved to Supabase so they're one tap away next time.
 */
export function KitchenMusic({ stations }: { stations: MusicStation[] }) {
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const [current, setCurrent] = useState<{ ref: YouTubeRef; label: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  /* Build (or rebuild) the player whenever the selected station changes. */
  useEffect(() => {
    if (!current || !hostRef.current) return;
    let cancelled = false;

    (async () => {
      const YT = await loadYouTubeAPI();
      if (cancelled || !hostRef.current) return;

      playerRef.current?.destroy();
      hostRef.current.innerHTML = "";
      const mount = document.createElement("div");
      hostRef.current.appendChild(mount);

      const common = {
        height: "100%",
        width: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          autoplay: 1,
          ...(current.ref.kind === "playlist"
            ? { list: current.ref.id, listType: "playlist" }
            : {}),
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            e.target.setVolume(volume);
            if (muted) e.target.mute();
            e.target.playVideo();
            setPlaying(true);
          },
          onStateChange: (e: { data: number }) => {
            if (!window.YT) return;
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      };

      playerRef.current = new YT.Player(mount, {
        ...common,
        ...(current.ref.kind === "video" ? { videoId: current.ref.id } : {}),
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => () => playerRef.current?.destroy(), []);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);

  const changeVolume = (v: number) => {
    setVolume(v);
    playerRef.current?.setVolume(v);
    if (v > 0 && muted) {
      playerRef.current?.unMute();
      setMuted(false);
    }
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };

  const play = (s: MusicStation) =>
    setCurrent({ ref: { kind: s.kind, id: s.youtube_id }, label: s.label });

  const playPasted = () => {
    const ref = parseYouTube(paste);
    if (!ref) {
      setPasteError(t("kitchen.musicBadLink"));
      return;
    }
    setPasteError(null);
    setCurrent({ ref, label: defaultLabel(ref) });
  };

  return (
    <div className="space-y-4">
      {/* ---------- Now playing ---------- */}
      <Panel accent="kitchen">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Music className="h-4 w-4 text-orange-300" /> {t("kitchen.musicTitle")}
          </h3>
          {current && (
            <span className="truncate rounded-full bg-white/[0.06] px-3 py-1 text-[0.7rem] text-white/70">
              {current.label}
            </span>
          )}
        </div>

        {/* The iframe itself. Kept visible but compact — YouTube's terms
            require the player to remain visible while audio plays. */}
        <div
          ref={hostRef}
          className={cn(
            "mt-3 overflow-hidden rounded-2xl border border-hairline bg-black transition-all",
            current ? "aspect-video w-full max-w-md" : "hidden",
          )}
        />

        {!current && (
          <p className="mt-2 text-xs text-white/45">{t("kitchen.musicIdle")}</p>
        )}

        {current && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => playerRef.current?.previousVideo()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full glass text-white/70 hover:text-white"
              aria-label={t("kitchen.musicPrev")}
              title={t("kitchen.musicPrev")}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-orange-400/90 text-black transition-transform hover:-translate-y-0.5"
              aria-label={playing ? t("kitchen.musicPause") : t("kitchen.musicPlay")}
              title={playing ? t("kitchen.musicPause") : t("kitchen.musicPlay")}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => playerRef.current?.nextVideo()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full glass text-white/70 hover:text-white"
              aria-label={t("kitchen.musicNext")}
              title={t("kitchen.musicNext")}
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="ml-2 flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-white/60 hover:text-white"
                aria-label={muted ? t("kitchen.musicUnmute") : t("kitchen.musicMute")}
                title={muted ? t("kitchen.musicUnmute") : t("kitchen.musicMute")}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="h-1 w-28 cursor-pointer accent-orange-300"
                aria-label={t("kitchen.musicVolume")}
              />
            </div>
          </div>
        )}
      </Panel>

      {/* ---------- Paste a link ---------- */}
      <Panel>
        <h3 className="text-sm font-semibold">{t("kitchen.musicPasteTitle")}</h3>
        <p className="mt-1 mb-3 text-xs text-white/45">{t("kitchen.musicPasteHint")}</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setPasteError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && playPasted()}
            placeholder="https://music.youtube.com/watch?v=…"
            className={cn(inputClass, "min-w-0 flex-1")}
          />
          <button
            onClick={playPasted}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
          >
            <Play className="h-4 w-4" /> {t("kitchen.musicPlayNow")}
          </button>
          <form
            action={(fd) => {
              const ref = parseYouTube(String(fd.get("url") ?? ""));
              if (!ref) {
                setPasteError(t("kitchen.musicBadLink"));
                return;
              }
              fd.set("kind", ref.kind);
              fd.set("youtube_id", ref.id);
              if (!String(fd.get("label") ?? "").trim()) fd.set("label", defaultLabel(ref));
              startTransition(() => addMusicStation(fd));
              setPaste("");
            }}
          >
            <input type="hidden" name="url" value={paste} />
            <input type="hidden" name="label" value="" />
            <button
              type="submit"
              disabled={!paste.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl glass px-4 py-2 text-sm text-white/75 hover:text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> {t("kitchen.musicSave")}
            </button>
          </form>
        </div>
        {pasteError && <p className="mt-2 text-xs text-red-300">{pasteError}</p>}
      </Panel>

      {/* ---------- Saved stations ---------- */}
      <Panel>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="h-4 w-4 text-accent-soft" /> {t("kitchen.musicStations")}
        </h3>
        <p className="mt-1 mb-4 text-xs text-white/45">{t("kitchen.musicStationsHint")}</p>

        {stations.length === 0 ? (
          <EmptyState icon={Music} title={t("kitchen.musicNoStations")} hint={t("kitchen.musicNoStationsHint")} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => {
              const ref: YouTubeRef = { kind: s.kind, id: s.youtube_id };
              const thumb = thumbnailUrl(ref);
              const active = current?.ref.id === s.youtube_id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
                    active ? "border-orange-300/50 bg-orange-400/10" : "border-hairline bg-white/[0.02] hover:bg-white/[0.04]",
                  )}
                >
                  <button onClick={() => play(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="relative flex h-11 w-16 flex-none items-center justify-center overflow-hidden rounded-lg bg-black/60">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Radio className="h-4 w-4 text-white/40" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-white/85">{s.label}</span>
                      <span className="block text-[0.6rem] uppercase tracking-wider text-white/35">
                        {s.kind === "playlist" ? t("kitchen.musicPlaylist") : t("kitchen.musicTrack")}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => startTransition(() => deleteMusicStation(s.id))}
                    className="flex-none text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                    aria-label={t("kitchen.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
