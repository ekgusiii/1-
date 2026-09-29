/** Upper edge of the sky shader's perspective term (`mix(0.4, 2.4, …)`). */
export const CLOUD_PERSP_MAX = 2.4;

/** Fastest upward scroll in the sky shader (`mix(0.1, 0.82, …)` at the top). */
export const CLOUD_SPD_MAX = 0.82;

/**
 * Seconds of sky time for the upper cloud field to travel one full rise.
 * `p.y` at the top of the frame is `CLOUD_PERSP_MAX`, and it moves at `CLOUD_SPD_MAX`.
 */
export const CLOUD_RISE_SEC = CLOUD_PERSP_MAX / CLOUD_SPD_MAX;

type Listener = (progress: number) => void;

let progress = 0;
const listeners = new Set<Listener>();

export function readCloudRise() {
  return progress;
}

export function publishCloudRise(clock: number) {
  const next = clock <= 0 ? 0 : Math.min(1, clock / CLOUD_RISE_SEC);
  if (next === progress) {
    return;
  }
  progress = next;
  for (const listener of listeners) {
    listener(progress);
  }
}

export function resetCloudRise() {
  if (progress === 0) {
    return;
  }
  progress = 0;
  for (const listener of listeners) {
    listener(progress);
  }
}

export function subscribeCloudRise(listener: Listener) {
  listeners.add(listener);
  listener(progress);
  return () => {
    listeners.delete(listener);
  };
}
