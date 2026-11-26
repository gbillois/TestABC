// =====================================================================================
//  Le Gardien de Mousse : the game
//  ONE place to adapt the game. Every number and colour that shapes the look or the feel
//  lives here; the other modules only read it. Change a value, reload the page.
// =====================================================================================

export const CONFIG = {
  // ---------- light and atmosphere (a golden sunrise, as in the film) ----------
  sun: {
    direction: [0.55, 0.32, -0.77],   // where the light comes FROM (normalised in code)
    color: "#ffd7a0", intensity: 2.5,
    skyFill: "#c3dcd4", groundFill: "#5d6e3c", fillIntensity: 1.45,
    shadowSize: 90,                   // half-width of the area covered by sharp shadows (world units)
  },
  sky: {
    zenith: "#86b3c2", mid: "#d6dfc4", horizon: "#f7cf92", sunGlow: "#fff0c8",
    cloudLight: "#fbe7d0", cloudShade: "#d79fb0", cloudBand: [0.06, 0.42], // painted streak clouds (elevation range)
    ridge: "#a9b8c6",                  // distant misty mountain line on the horizon
  },
  fog: { color: "#efd9ae", skyColor: "#f4c890", densityForest: 0.0026, densitySky: 0.0008 },

  // ---------- the forest ----------
  world: {
    seed: 1789,
    clearingRadius: 52,                // empty glade around the sleeping keeper
    forestRadius: 520,                 // near forest (full detail trees)
    farRadius: 1700,                   // distant canopy carpet up to here
    treeCount: 420,
    treeHeight: [55, 95], trunkRadius: [1.0, 2.1],
    trunkColor: "#5b4636", trunkDark: "#2f2622",
    leaf: ["#2f5a2a", "#5e8a32", "#a9c24f"],          // shadow, mid, highlight
    grass: { count: 70000, patch: 120, base: "#2c5223", tip: "#b9c95a" },
    flowers: 2600,
    nearDetailRadius: 220,             // canopy blobs closer than this to the glade get more polygons
    hills: 4.0,                        // gentle relief height
    limit: 1500,                       // soft wall: you are gently turned back past this distance
  },
  clouds: {                            // the sea of clouds you fly above
    altitude: 118, thickness: 30, puffs: 2600, area: 2600,
    top: "#fff6e6", side: "#f4c9a2", under: "#b9a3c8",
    appearFrom: 60,                    // camera height where the cloud sea starts to condense
  },

  // ---------- the keeper (the mossy robot) ----------
  robot: {
    metal: "#a49eb4", panel: "#e6c79c", teal: "#6fa89c", rust: "#a8442f", dark: "#3a3440",
    fanA: "#c4402c", fanB: "#f4ead6",
    moss: ["#355e25", "#74a034", "#c8d65c"],          // shadow, mid, highlight
    flower: ["#ffffff", "#c9b8f0", "#fff2a6"],
    mossDensity: 1.0,                  // 0.3 = a few patches, 1.5 = a walking garden
    glow: "#ffbf5a",                   // chest porthole and eyes when awake
    outline: "#2a2230", outlineWidth: 0.05,
    scale: 1.7,                        // overall size (1 = about 14 units tall at the fans)
    shoulderTree: true,                // the little tree growing on the right shoulder
  },

  // ---------- how it moves ----------
  move: {
    walk: 10, run: 18, accel: 4, turn: 2.4,           // ground speeds (units/s), turn rate (rad/s)
    jump: 24, gravity: 40,
    flyCruise: 42, flyBoost: 95, flyClimb: 28, flyTurn: 1.5, flyAccel: 1.4,
    takeoffTime: 0.9,                  // crouch before the launch
    wakeHold: 1.8,                     // seconds of holding to wake the keeper
  },
  camera: {
    fov: 50, ground: { dist: 46, height: 15 }, fly: { dist: 66, height: 16 },
    lag: 4.5, mouseSensitivity: 0.0042,
  },

  // ---------- goals ----------
  goals: {
    seeds: 6,                          // golden seeds hidden in the forest (some high in the canopy)
    rings: 6,                          // rings of light above the clouds
    ringAltitude: [205, 300], ringRadius: 11,
  },

  // ---------- picture ----------
  // "haute" = painterly filter + many details, "moyenne", "rapide" (for small devices)
  quality: {
    haute:   { pixelRatio: 1.5, paint: 3, shadows: 2048, grass: 1.0, bloom: true },
    moyenne: { pixelRatio: 1.0, paint: 2, shadows: 1536, grass: 0.6, bloom: true },
    rapide:  { pixelRatio: 0.8, paint: 0, shadows: 1024, grass: 0.3, bloom: false },
  },
  post: { bloomThreshold: 1.25, bloomStrength: 0.45, grain: 0.05, vignette: 0.32, warmth: 0.06 },

  // ---------- sound ----------
  sound: { music: "son/musique.m4a", musicVolume: 0.45, sfxVolume: 0.8 },
};
