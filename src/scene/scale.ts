// Scene units are Earth-radii. Real distances are compressed for viewability;
// the Earth-centred view prioritises readability of near-Earth traffic over
// true-to-scale spacing (which would leave Earth an invisible dot).

export const SCENE = {
  EARTH_RADIUS: 1,
  MOON_RADIUS: 0.273,
  MOON_DISTANCE: 42, // real ~60.3 Earth radii, compressed
  SUN_RADIUS: 55,
  SUN_DISTANCE: 1400,
  STAR_RADIUS: 3400,
  /** Radial thickness of the shell that NEO markers are spread across. */
  MARKER_SHELL: 70,
  /** Marker billboard base size in world units. */
  MARKER_BASE_SIZE: 1.4,

  // ---- Heliocentric "real orbits" mode ----
  /** Scene units per astronomical unit in heliocentric mode. */
  AU_UNIT: 46,
  /** Central Sun sphere radius in heliocentric mode. */
  SUN_CORE_RADIUS: 2.6,
  /** NEO marker base size (world units) in heliocentric mode. */
  MARKER_BASE_SIZE_HELIO: 1.7,
  /** Default camera distance when entering heliocentric mode. */
  HELIO_CAM_RADIUS: 120,
};
