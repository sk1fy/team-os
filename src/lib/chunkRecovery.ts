const CHUNK_RELOAD_KEY = 'teamos:last-stale-chunk-reload';
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

type ChunkRecoveryWindow = Pick<
  Window,
  'addEventListener' | 'removeEventListener' | 'location' | 'sessionStorage'
>;

export function recoverFromStaleChunk(
  event: Event,
  target: Pick<ChunkRecoveryWindow, 'location' | 'sessionStorage'> = window,
  now = Date.now(),
): boolean {
  let lastReload = 0;
  try {
    lastReload = Number(target.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }

  if (Number.isFinite(lastReload) && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
    return false;
  }

  event.preventDefault();
  try {
    target.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Reload still repairs stale HTML even when the loop guard cannot persist.
  }
  target.location.reload();
  return true;
}

/**
 * Vite emits this event when a lazy import points at a chunk removed by a new
 * deployment. One guarded reload fetches the current HTML/chunk manifest.
 */
export function installChunkRecovery(target: ChunkRecoveryWindow = window): () => void {
  const listener = (event: Event) => recoverFromStaleChunk(event, target);
  target.addEventListener('vite:preloadError', listener);
  return () => target.removeEventListener('vite:preloadError', listener);
}
