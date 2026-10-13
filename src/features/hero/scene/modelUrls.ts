/**
 * Where the scenes' models are, in a module with no three.js in it: the
 * home page (a server component) names them to the browser in its head, so
 * they download beside the page's own code, and the scenes load them
 * (`useGLTF`, whose fetch the browser serves from that preload). Left to
 * the scene's chunk, they started only after every script, hydration and
 * the chunk itself. One place for each URL: a preload that names a file
 * nobody loads is fetched for nothing (and Chrome warns "preloaded but not
 * used").
 */

/** "Convertible" by Poly by Google, CC BY 3.0 (see public/models/poly-convertible). */
export const CAR_URL = "/models/poly-convertible/convertible.glb";

/** Jesús, built with MakeHuman / MPFB from CC0 assets (see public/models/makehuman-driver). */
export const DRIVER_URL = "/models/makehuman-driver/driver.glb";

/** His aviators, an original model (see public/models/sunglasses). */
export const SUNGLASSES_URL = "/models/sunglasses/aviator.glb";

/** Quaternius "Cars Pack" (CC0): the traffic's models, each by name. */
export const TRAFFIC_CAR = {
  sportsCar: "/models/quaternius-cars/SportsCar.glb",
  sportsCar2: "/models/quaternius-cars/SportsCar2.glb",
  normalCar1: "/models/quaternius-cars/NormalCar1.glb",
  taxi: "/models/quaternius-cars/Taxi.glb",
  suv: "/models/quaternius-cars/SUV.glb",
} as const;

/** The traffic's models in the order the traffic loads them (`makeTraffic` picks a model by its index). */
export const TRAFFIC_URLS = [
  TRAFFIC_CAR.sportsCar,
  TRAFFIC_CAR.sportsCar2,
  TRAFFIC_CAR.normalCar1,
  TRAFFIC_CAR.taxi,
  TRAFFIC_CAR.suv,
] as const;

/** How the home page asks for a model ahead of the scene: at the browser's own priority, or after everything else. */
export type ModelPreload = { url: string; fetchPriority?: "low" };

/**
 * Every model the home page preloads (`src/app/[lang]/page.tsx`, never the
 * layout: the 404 shares it and loads no scene). His car, the driver and
 * the aviators are in the first frame; the traffic waits behind the page's
 * own code and fonts (low priority), since a fast link has it long before
 * the scene asks and a slow one needs that bandwidth for the page first.
 */
export const MODEL_PRELOADS: readonly ModelPreload[] = [
  { url: DRIVER_URL },
  { url: CAR_URL },
  { url: SUNGLASSES_URL },
  ...TRAFFIC_URLS.map((url): ModelPreload => ({ url, fetchPriority: "low" })),
];
