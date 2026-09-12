/**
 * New-ticket chime for the kitchen screen.
 *
 * Web: a two-tone WebAudio "ding-dong" synthesised on the fly (no asset,
 * nothing to bundle). Browsers only let an AudioContext run after a user
 * gesture, so `unlockAudio()` must be called synchronously from a tap
 * handler (the sound toggle) before anything can play.
 * Native: vibration -- no extra native module, so no rebuild needed.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Vibration } from "react-native";

export const SOUND_PREF_KEY = "aimenu.kitchen.sound";

let ctx: AudioContext | null = null;

export async function loadSoundPref(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SOUND_PREF_KEY)) === "1";
  } catch {
    return false;
  }
}

export function saveSoundPref(on: boolean): Promise<void> {
  return AsyncStorage.setItem(SOUND_PREF_KEY, on ? "1" : "0").catch(() => {});
}

/** True once the browser lets us play (or always on native). */
export function isAudioUnlocked(): boolean {
  if (Platform.OS !== "web") return true;
  return ctx?.state === "running";
}

/** Call synchronously inside a user gesture. Idempotent. */
export function unlockAudio(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  // A silent buffer nudges Safari into the "unlocked" state.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  src.connect(ctx.destination);
  src.start(0);
}

function tone(freq: number, at: number, dur: number, gain = 0.25) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** "Ding-dong" twice: A5 880 Hz 150 ms → D6 1175 Hz 250 ms, repeated after 450 ms. */
export function playNewTicketChime(): void {
  if (Platform.OS !== "web") {
    Vibration.vibrate([0, 300, 150, 300]);
    return;
  }
  if (!ctx) return;
  if (ctx.state !== "running") {
    void ctx.resume();
    return;
  }
  const t0 = ctx.currentTime;
  for (const off of [0, 0.45]) {
    tone(880, t0 + off, 0.15);
    tone(1175, t0 + off + 0.15, 0.25);
  }
}
