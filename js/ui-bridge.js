// late-bound UI hooks so game logic can talk to the DOM layer without import cycles
const noop = () => {};
export const UI = { toast: noop, tip: noop, setMode: noop, zoneBanner: noop, startHaul: noop, omen: noop, visit: noop, refresh: noop, showHaul: noop, eggFly: noop };
