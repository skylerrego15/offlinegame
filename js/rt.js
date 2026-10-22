// shared runtime (non-saved) state
export const R = {
  W: 390, H: 844, dpr: 1,
  PPM: 5.6,          // pixels per meter
  camY: -300,        // world px at top of screen
  camVY: 0,
  t: 0,              // seconds since start
  timeScale: 1,
  mode: 'loading',   // ship | aim | dive | reel | reveal
  panel: null,
  field: null,
  hp: null,          // harpoon runtime
  aimAngle: 0,
  aiming: false,
  power: 0.5,
  steer: 0,
  touching: false,
  shipPan: 0,
  visit: null,       // tentacle visitation event
  haul: [],
  ship: null,        // ship geometry cache
};
