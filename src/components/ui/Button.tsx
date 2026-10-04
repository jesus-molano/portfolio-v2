import type { ComponentProps } from "react";
import styles from "./Control.module.css";

/** ghost: page chrome; primary: outlined call to action; solid: the single main action. */
export type ControlVariant = "ghost" | "primary" | "solid";
export type ControlSize = "sm" | "md" | "lg";

export function controlClass(variant: ControlVariant, size: ControlSize, extra?: string): string {
  return [styles.control, styles[variant], styles[size], extra].filter(Boolean).join(" ");
}

/** React 19: `ref` is a plain prop, so it is part of the button props. */
type Props = ComponentProps<"button"> & { variant?: ControlVariant; size?: ControlSize };

/**
 * The site button. For an on/off control pass `aria-pressed`: the styles
 * show both states. Defaults to `type="button"`.
 */
export function Button({ variant = "ghost", size = "sm", className, type = "button", ...rest }: Props) {
  return <button type={type} className={controlClass(variant, size, className)} {...rest} />;
}
