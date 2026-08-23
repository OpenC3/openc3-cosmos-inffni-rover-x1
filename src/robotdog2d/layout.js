/*
# Copyright 2026, OpenC3, Inc.
# All Rights Reserved
*/

// Static geometry for the 2D (side profile) Rover X1 schematic.
//
// Everything is expressed in the widget's SVG user space (VIEW.w x VIEW.h) so
// the whole panel scales with the container. The rover faces +X (to the right).

export const VIEW = { w: 1240, h: 720 }

// Side profile skeleton, proportioned off the real rover: a 440 mm body over a
// 200 mm thigh and calf. The shell is static; the legs are drawn from the live
// joint angles rooted at the hip pixels below.
export const BODY = {
  // Chassis shell: flat top deck, tapered rear, squared front shoulder.
  shell: 'M 468 252 Q 458 252 454 262 L 448 300 Q 446 330 468 336 '
    + 'L 748 348 Q 776 350 780 326 L 784 268 Q 786 250 764 249 Z',
  // Top deck plate seam.
  deck: 'M 476 256 L 762 253',
  // Shoulder / hip housing shrouds where the legs bolt on.
  shrouds: [
    { x: 698, y: 266, w: 78, h: 76, r: 10 },
    { x: 456, y: 272, w: 64, h: 64, r: 10 },
  ],
  // Front sensor pod and its carry handle.
  head: 'M 784 250 L 852 252 Q 872 254 872 272 L 870 330 Q 868 346 850 344 '
    + 'L 786 336 Z',
  handle: 'M 792 262 L 856 265 L 856 281 L 792 278 Z',
  vents: [
    { x: 556, y: 264, w: 100, h: 6 },
    { x: 556, y: 276, w: 100, h: 6 },
  ],
  // Camera + search light apertures on the head.
  camera: { cx: 856, cy: 300, r: 8 },
  light: { x: 798, y: 306, w: 56, h: 16 },
  // Battery bay outline under the shell.
  bay: { x: 528, y: 300, w: 150, h: 32 },
  // Ground line the feet stand on.
  ground: { y: 636, x1: 300, x2: 980 },
}

export const LINK = {
  abductor: 30, // hip yoke, drawn as a short stub toward the viewer
  thigh: 148,
  calf: 148,
  peg: 26, // peg foot off the ankle, in line with the calf
  // Shell widths at each end of a link, in SVG units. The real rover has a
  // broad thigh shell tapering into a slim calf tube.
  thighWidth: [44, 28],
  calfWidth: [20, 12],
  yokeWidth: [34, 28],
  pegWidth: [12, 9],
  hipRadius: 24,
  kneeRadius: 14,
  ankleRadius: 11,
  pegTipRadius: 7,
}

// Hip roots in SVG space. near = leg on the viewer's side of the body (drawn
// bright), far = leg on the opposite side (drawn dimmed and offset).
// anchor is where that leg's callout leader line terminates.
export const LEGS = [
  {
    id: 'RIGHT_FRONT',
    label: 'RF',
    short: 'right_front',
    hip: { x: 742, y: 330 },
    near: true,
    end: 1,
    side: 1,
  },
  {
    id: 'LEFT_FRONT',
    label: 'LF',
    short: 'left_front',
    hip: { x: 712, y: 316 },
    near: false,
    end: 1,
    side: -1,
  },
  {
    id: 'RIGHT_REAR',
    label: 'RR',
    short: 'right_rear',
    hip: { x: 490, y: 320 },
    near: true,
    end: -1,
    side: 1,
  },
  {
    id: 'LEFT_REAR',
    label: 'LR',
    short: 'left_rear',
    hip: { x: 460, y: 306 },
    near: false,
    end: -1,
    side: -1,
  },
]

// Callout box placement, one per leg, plus the fixed panels.
export const BOXES = {
  RIGHT_FRONT: { x: 962, y: 244, w: 254, h: 172 },
  LEFT_FRONT: { x: 962, y: 52, w: 254, h: 172 },
  RIGHT_REAR: { x: 24, y: 244, w: 254, h: 172 },
  LEFT_REAR: { x: 24, y: 52, w: 254, h: 172 },
}

export const IMU_BOX = { x: 470, y: 44, w: 300, h: 118 }
export const POWER_BOX = { x: 400, y: 652, w: 470, h: 58 }
export const STATE_BOX = { x: 24, y: 444, w: 254, h: 108 }
export const BUS_BOX = { x: 962, y: 444, w: 254, h: 130 }

// Joint names in the order they appear in the <LEG>_Q / <LEG>_*_TEMP arrays.
export const JOINTS = ['ABD', 'HIP', 'KNEE', 'ANK']

// Blueprint palette, matched to the dark COSMOS screen background.
export const COLORS = {
  bg: '#080c11',
  grid: 'rgba(41, 182, 246, 0.08)',
  frame: '#26404f',
  leader: 'rgba(79, 195, 247, 0.55)',
  line: '#4fc3f7',
  lineDim: '#1e5a78',
  fill: 'rgba(33, 150, 243, 0.10)',
  fillDim: 'rgba(33, 150, 243, 0.04)',
  text: '#cfd8dc',
  label: '#607d8b',
  ok: '#00e676',
  warn: '#ffd600',
  alarm: '#ff5252',
  power: '#ff5252',
}

const TEMP_STOPS = [
  { t: 20, c: [41, 182, 246] }, // cool - cyan
  { t: 45, c: [0, 230, 118] }, // nominal - green
  { t: 65, c: [255, 214, 0] }, // warm - yellow
  { t: 85, c: [255, 82, 82] }, // hot - red
]

// Map a motor temperature (degC) onto the thermal ramp above.
export function tempColor(temp) {
  if (!Number.isFinite(temp)) {
    return COLORS.lineDim
  }
  const first = TEMP_STOPS[0]
  const last = TEMP_STOPS[TEMP_STOPS.length - 1]
  if (temp <= first.t) {
    return `rgb(${first.c.join(',')})`
  }
  if (temp >= last.t) {
    return `rgb(${last.c.join(',')})`
  }
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const a = TEMP_STOPS[i]
    const b = TEMP_STOPS[i + 1]
    if (temp <= b.t) {
      const f = (temp - a.t) / (b.t - a.t)
      const rgb = a.c.map((v, j) => Math.round(v + (b.c[j] - v) * f))
      return `rgb(${rgb.join(',')})`
    }
  }
  return COLORS.line
}

// Capsule (stadium) outline from point a to point b, wa/wb wide at each end.
// Used for every leg link so the schematic reads as machined shells instead of
// single stroke sticks.
export function capsulePath(a, b, wa, wb) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  // unit normal to the link axis
  const nx = -dy / len
  const ny = dx / len
  const ra = wa / 2
  const rb = wb / 2
  const p = (pt, r, sign) => `${pt.x + sign * nx * r},${pt.y + sign * ny * r}`
  return [
    `M ${p(a, ra, 1)}`,
    `L ${p(b, rb, 1)}`,
    `A ${rb} ${rb} 0 0 1 ${p(b, rb, -1)}`,
    `L ${p(a, ra, -1)}`,
    `A ${ra} ${ra} 0 0 1 ${p(a, ra, 1)}`,
    'Z',
  ].join(' ')
}

// A seam line down the middle of a link, inset from both ends, so the shells
// look panelled rather than flat.
export function seamPath(a, b, inset = 0.22) {
  const at = { x: a.x + (b.x - a.x) * inset, y: a.y + (b.y - a.y) * inset }
  const bt = {
    x: a.x + (b.x - a.x) * (1 - inset),
    y: a.y + (b.y - a.y) * (1 - inset),
  }
  return `M ${at.x},${at.y} L ${bt.x},${bt.y}`
}

// Forward kinematics in the sagittal (side view) plane. Angles are radians,
// positive rotation swings the link toward the rear of the rover.
// Returns the knee pixel, the ankle pixel and the peg tip pixel.
export function legPoints(hip, angles) {
  const hipPitch = Number.isFinite(angles[1]) ? angles[1] : 0
  const knee = Number.isFinite(angles[2]) ? angles[2] : 0
  const ankle = Number.isFinite(angles[3]) ? angles[3] : 0
  const a1 = hipPitch
  const a2 = hipPitch + knee
  const a3 = a2 + ankle
  const kneePt = {
    x: hip.x - LINK.thigh * Math.sin(a1),
    y: hip.y + LINK.thigh * Math.cos(a1),
  }
  const footPt = {
    x: kneePt.x - LINK.calf * Math.sin(a2),
    y: kneePt.y + LINK.calf * Math.cos(a2),
  }
  const pegPt = {
    x: footPt.x - LINK.peg * Math.sin(a3),
    y: footPt.y + LINK.peg * Math.cos(a3),
  }
  return { kneePt, footPt, pegPt }
}
