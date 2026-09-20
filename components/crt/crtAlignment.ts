export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Previous reveal radius was ~0.39 of center-to-corner. */
const PREVIOUS_REVEAL_RADIUS = 0.39;
const RADIUS_MULTIPLIER = 2.55;

export const INFLUENCE_RADIUS_FACTOR = Math.min(
  1.05,
  PREVIOUS_REVEAL_RADIUS * RADIUS_MULTIPLIER,
);

/** Fully aligned core as a fraction of the influence radius. */
export const ALIGN_CORE_FACTOR = 0.08;
export const GUIDE_UNLOCK_PREVIEW = 0.9;

const PREVIEW_EXPONENT = 1.28;
const MISALIGN_EXPONENT = 0.88;
const RESIDUAL_PREVIEW = 0.05;
export const FIELD_LERP_TIME = 0.16;

export type Hotspot = {
  id: string;
  x: number;
  y: number;
};

export type AlignmentField = {
  nearestId: string | null;
  preview: number;
  misalign: number;
};

export function layoutHotspotPositions(count: number) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [{x: 0.5, y: 0.5}];
  }

  if (count === 2) {
    return [
      {x: 0.32, y: 0.5},
      {x: 0.68, y: 0.5},
    ];
  }

  if (count === 3) {
    return [
      {x: 0.5, y: 0.34},
      {x: 0.32, y: 0.64},
      {x: 0.68, y: 0.64},
    ];
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const positions = [];

  for (let index = 0; index < count; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.push({
      x: (col + 1) / (cols + 1),
      y: (row + 1) / (rows + 1),
    });
  }

  return positions;
}

export function previewFromUnitDistance(unitDistance: number) {
  const t = clamp01(unitDistance);
  return (1 - t) ** PREVIEW_EXPONENT;
}

export function misalignFromUnitDistance(unitDistance: number) {
  const t = clamp01(unitDistance);
  return t ** MISALIGN_EXPONENT;
}

function cornerDistance(x: number, y: number, width: number, height: number) {
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ] as const;

  let max = 0;
  for (const [cx, cy] of corners) {
    const distance = Math.hypot(x - cx, y - cy);
    if (distance > max) {
      max = distance;
    }
  }

  return max;
}

export function fieldFromDistance(
  distance: number,
  influenceRadius: number,
  maxDistance: number,
): {preview: number; misalign: number} {
  if (influenceRadius <= 0 || maxDistance <= 0) {
    return {preview: 0, misalign: 1};
  }

  const t = distance / influenceRadius;

  if (t <= ALIGN_CORE_FACTOR) {
    return {preview: 1, misalign: 0};
  }

  if (t >= 1) {
    const residual = clamp01(1 - distance / maxDistance);
    const preview = RESIDUAL_PREVIEW * residual * residual;
    return {
      preview,
      misalign: 1 - preview * 0.4,
    };
  }

  return {
    preview: previewFromUnitDistance(t),
    misalign: misalignFromUnitDistance(t),
  };
}

export function computeAlignmentField(
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
  hotspots: Hotspot[],
): AlignmentField {
  if (!hotspots.length || width <= 0 || height <= 0) {
    return {nearestId: null, preview: 0, misalign: 1};
  }

  let nearest = hotspots[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestMaxDistance = 0;

  for (const hotspot of hotspots) {
    const x = hotspot.x * width;
    const y = hotspot.y * height;
    const distance = Math.hypot(pointerX - x, pointerY - y);
    const maxDistance = cornerDistance(x, y, width, height);

    if (distance < nearestDistance) {
      nearest = hotspot;
      nearestDistance = distance;
      nearestMaxDistance = maxDistance;
    }
  }

  const influenceRadius = nearestMaxDistance * INFLUENCE_RADIUS_FACTOR;
  const field = fieldFromDistance(
    nearestDistance,
    influenceRadius,
    nearestMaxDistance,
  );

  return {
    nearestId: nearest.id,
    preview: field.preview,
    misalign: field.misalign,
  };
}

export function lerpToward(
  current: number,
  target: number,
  dt: number,
  time = FIELD_LERP_TIME,
) {
  const k = 1 - Math.exp(-Math.max(dt, 0) / time);
  return current + (target - current) * k;
}

export function misalignFromDistance(distance: number, maxDistance: number) {
  return fieldFromDistance(
    distance,
    maxDistance * INFLUENCE_RADIUS_FACTOR,
    maxDistance,
  ).misalign;
}

export function revealFromMisalign(misalign: number) {
  return previewFromUnitDistance(misalign);
}
