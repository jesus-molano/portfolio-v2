"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Names the part in the console warning. */
  name?: string;
  /** Called once when the children fail, for example to release the loading screen. */
  onError?: () => void;
};

/**
 * Renders nothing when its children throw. Wraps the whole canvas (WebGL
 * failure leaves the CSS sky) and each group of loaded models inside the
 * scene, so one missing GLB hides only that part.
 */
export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`${this.props.name ?? "Hero scene"} disabled:`, error.message, info.componentStack);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
