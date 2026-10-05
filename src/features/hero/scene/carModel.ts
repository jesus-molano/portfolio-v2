/**
 * Measurements of the hero car model, "Convertible" by Poly by Google
 * (public/models/poly-convertible), in model units unless noted. Kept out of
 * Car.tsx so the tests can check them without loading the GLB.
 */
export const CAR_MODEL = {
  /** The model is ~10 units long; a real roadster is ~4.5 m. */
  scale: 0.45,
  /** Height of the wheel origins (the axles) above the model's floor. */
  wheelCenterY: 0.856,
  /** Tyre radius: the tyres touch the model's floor (y = 0). */
  wheelRadius: 0.856,
} as const;

/** Tyre radius in metres. */
export const WHEEL_RADIUS = CAR_MODEL.wheelRadius * CAR_MODEL.scale;

/** World height of the tyres' contact patch for a car group placed at `carY`. */
export function tyreBottomY(carY: number): number {
  return carY + (CAR_MODEL.wheelCenterY - CAR_MODEL.wheelRadius) * CAR_MODEL.scale;
}
