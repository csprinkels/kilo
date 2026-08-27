// CARTO's street tiles need a key since 2026 (free: carto.com/basemaps/apikey, 5M tiles a month).
// Without one the tiles arrive stamped "API KEY REQUIRED", so with no key there is no tile map at all:
// Roads shows the drawn island (the same picture it uses with no signal) and the rain radar stays hidden.
const KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
export const TILES = KEY ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${KEY}` : null;
export const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>';
