/**
 * Where the scenes' models are, in a module with no three.js in it: the
 * home page (a server component) names them to the browser in its head, so
 * they download beside the page's own code, and the scenes load them
 * (`useGLTF`, whose fetch the browser serves from that preload). Left to
 * the scene's chunk, they started only after every script, hydration and
 * the chunk itself. One place for each URL: a preload that names a file
 * nobody loads is fetched for nothing (and Chrome warns "preloaded but not
 * used").
 *
 * Each address ends in the start of its file's SHA-256 (`?v=`, held to the
 * file by modelUrls.test.ts, which prints the new one after a rebuild), so
 * a new model is a new address: next.config.ts lets the browser keep them
 * a year without asking, and the code names their bones, meshes and
 * materials (driverPose.ts, Car.tsx), which an old copy kept under the
 * same address would not have.
 */

/** "Convertible" by Poly by Google, CC BY 3.0 (see public/models/poly-convertible). */
export const CAR_URL = "/models/poly-convertible/convertible.glb?v=94de61872e";

/** Jesús, built with MakeHuman / MPFB from CC0 assets (see public/models/makehuman-driver). */
export const DRIVER_URL = "/models/makehuman-driver/driver.glb?v=602a503468";

/** His aviators, an original model (see public/models/sunglasses). */
export const SUNGLASSES_URL = "/models/sunglasses/aviator.glb?v=643f2662d2";

/** Quaternius "Cars Pack" (CC0): the traffic's models, each by name. */
export const TRAFFIC_CAR = {
  sportsCar: "/models/quaternius-cars/SportsCar.glb?v=c17e6361ef",
  sportsCar2: "/models/quaternius-cars/SportsCar2.glb?v=90b764bd1a",
  normalCar1: "/models/quaternius-cars/NormalCar1.glb?v=6fb0b21d59",
  taxi: "/models/quaternius-cars/Taxi.glb?v=bec11c5cce",
  suv: "/models/quaternius-cars/SUV.glb?v=db0ef4efac",
} as const;

/** The traffic's models in the order the traffic loads them (`makeTraffic` picks a model by its index). */
export const TRAFFIC_URLS = [
  TRAFFIC_CAR.sportsCar,
  TRAFFIC_CAR.sportsCar2,
  TRAFFIC_CAR.normalCar1,
  TRAFFIC_CAR.taxi,
  TRAFFIC_CAR.suv,
] as const;

/**
 * Every model the home page preloads, in the order it asks for them
 * (`src/app/[lang]/page.tsx`, never the layout: the 404 shares it and loads
 * no scene): his car, the driver and the aviators, in the first frame, then
 * the traffic. All at low priority: at the browser's own (high for a
 * fetch), the driver's megabyte went ahead of the page's async scripts
 * (low), and on a slow link hydration, and with it the start menu's keys,
 * its slab, SETTINGS and LOAD GAME, waited seconds behind the models. Low,
 * they queue behind the scripts the page names before them and still start
 * as the head is parsed; the scene cannot mount before those scripts
 * anyway.
 */
export const MODEL_PRELOADS: readonly string[] = [DRIVER_URL, CAR_URL, SUNGLASSES_URL, ...TRAFFIC_URLS];
