import Link from "next/link";
import type { ReactNode } from "react";
import { type ControlSize, type ControlVariant, controlClass } from "./Button";

type Props = {
  href: string;
  children: ReactNode;
  variant?: ControlVariant;
  size?: ControlSize;
  /** Opens in a new tab; pass the visually hidden "(opens in a new tab)" text in `children`. */
  external?: boolean;
  rel?: string;
};

/** A link that looks like the site button. Internal paths use next/link. */
export function ButtonLink({ href, children, variant = "ghost", size = "sm", external, rel }: Props) {
  const className = controlClass(variant, size);
  if (external) {
    return (
      <a className={className} href={href} target="_blank" rel={rel ?? "noopener noreferrer"}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href} rel={rel}>
      {children}
    </Link>
  );
}
