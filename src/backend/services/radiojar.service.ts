import { kdb } from "../infrastructure/knex";
import { logger } from "../infrastructure/logger.ts";

const RADIOJAR_STATION_ID = "ps7z45v12k8uv";
const RADIOJAR_NOW_PLAYING_URL = `https://www.radiojar.com/api/stations/${RADIOJAR_STATION_ID}/now_playing/`;
const POLL_INTERVAL_MS = 15_000;

interface RadiojarTrack {
  album?: string;
  sku?: string;
  thumb?: string;
  artist?: string;
  title?: string;
  show?: Record<string, unknown>;
  buy_urls?: string;
  info_urls?: string;
  duration?: string;
  guid?: string;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastGuid: string | null = null;
let serviceEnabled = false;
let manualOverrideActive = false;

export function isRadiojarServiceEnabled(): boolean {
  return serviceEnabled;
}

export function isManualOverrideActive(): boolean {
  return manualOverrideActive;
}

export function setManualOverride(active: boolean): void {
  manualOverrideActive = active;
  if (active) {
    logger.info("[Radiojar] Manual override enabled — auto-sync paused");
  } else {
    logger.info("[Radiojar] Manual override disabled — auto-sync resumed");
  }
}

async function fetchNowPlaying(): Promise<RadiojarTrack | null> {
  try {
    const response = await fetch(RADIOJAR_NOW_PLAYING_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(`[Radiojar] API returned ${response.status}`);
      return null;
    }
    const data: RadiojarTrack = await response.json();
    return data;
  } catch (error) {
    console.warn("[Radiojar] Fetch error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function syncTrackToDb(track: RadiojarTrack): Promise<void> {
  if (!track.title?.trim() || !track.guid) {
    console.warn("[Radiojar] Skipping track — missing title or guid");
    return;
  }

  if (track.guid === lastGuid) return;

  if (manualOverrideActive) {
    return;
  }

  const existing = await kdb("radio_tracks").where({ id: track.guid }).first();
  if (existing) {
    await kdb("radio_tracks")
      .where({ is_current: true })
      .update({ is_current: false });
    await kdb("radio_tracks")
      .where({ id: track.guid })
      .update({ is_current: true, played_at: new Date() });
    lastGuid = track.guid;
    return;
  }

  await kdb("radio_tracks").where({ is_current: true }).update({ is_current: false });

  const durationNum = track.duration ? parseInt(track.duration, 10) || null : null;

  await kdb("radio_tracks").insert({
    id: track.guid,
    title: track.title.trim(),
    artist: track.artist?.trim() || null,
    album: track.album?.trim() || null,
    cover_url: track.thumb?.trim() || null,
    duration: durationNum,
    is_current: true,
    played_at: new Date(),
    created_at: new Date(),
  });

  lastGuid = track.guid;
  logger.info(`[Radiojar] New track: "${track.title}" — ${track.artist || "unknown artist"}`);
}

async function pollOnce(): Promise<void> {
  if (!serviceEnabled) return;
  const track = await fetchNowPlaying();
  if (track) {
    await syncTrackToDb(track);
  }
}

export function startRadiojarService(): void {
  if (pollTimer) {
    console.warn("[Radiojar] Service already running");
    return;
  }

  serviceEnabled = true;
  logger.info("[Radiojar] Starting background polling service...");

  pollOnce();

  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
  logger.info(`[Radiojar] Polling every ${POLL_INTERVAL_MS / 1000}s`);
}

export function stopRadiojarService(): void {
  serviceEnabled = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info("[Radiojar] Service stopped");
  }
}
