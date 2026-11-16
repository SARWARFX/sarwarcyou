const AUDIO_MUTE_KEY = 'stream_vault_global_audio_muted';

type MuteListener = (isMuted: boolean) => void;
const listeners = new Set<MuteListener>();

/**
 * Returns true if website dock audio is muted.
 * Default is unmuted (false, i.e. "AUDIO: LIVE").
 */
export function getGlobalAudioMuted(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(AUDIO_MUTE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export function setGlobalAudioMuted(muted: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUDIO_MUTE_KEY, String(muted));
    }
  } catch {}
  listeners.forEach((fn) => {
    try {
      fn(muted);
    } catch {}
  });
}

export function toggleGlobalAudioMuted(): boolean {
  const next = !getGlobalAudioMuted();
  setGlobalAudioMuted(next);
  return next;
}

export function subscribeGlobalAudioMuted(fn: MuteListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
