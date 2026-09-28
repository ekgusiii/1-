export const PAGE_TRANSITION_MASTER_GAIN = 0.15;
export const PAGE_TRANSITION_ATTACK = 0.02;
export const PAGE_TRANSITION_RELEASE = 0.4;
export const PAGE_TRANSITION_DURATION = 0.5;

export const PAGE_FREQUENCY_SCALE = [
  220, 277.18, 329.63, 392, 440, 493.88, 554.37, 659.25,
] as const;

export const PAGE_FREQUENCY_BY_SLUG: Record<string, number> = {};

export function frequencyForPage(
  slug: string | null | undefined,
  index = 0,
) {
  if (slug && PAGE_FREQUENCY_BY_SLUG[slug] != null) {
    return PAGE_FREQUENCY_BY_SLUG[slug];
  }

  const length = PAGE_FREQUENCY_SCALE.length;
  const slot = ((Math.floor(index) % length) + length) % length;
  return PAGE_FREQUENCY_SCALE[slot];
}
