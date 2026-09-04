// CARTO's street tiles need a key since 2026 (free: carto.com/basemaps/apikey, 5M tiles a month).
// Without one the tiles arrive stamped "API KEY REQUIRED", so with no key there is no tile map at all:
// Roads shows the drawn island (the same picture it uses with no signal) and the rain radar stays hidden.
const KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
export const TILES = KEY ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${KEY}` : null;
/**
 * The rain radar wants the opposite of a street map: a ground with no colour of its own, so the
 * rain is the only thing coloured on it. CARTO's positron ("light_all") is that map. Voyager
 * above stays where the streets ARE the subject — Roads.
 */
export const TILES_LIGHT = KEY ? `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${KEY}` : null;
export const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>';
