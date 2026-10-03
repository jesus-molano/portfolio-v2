import { tokensToCssVariables } from "./tokens";

/**
 * Emits the design tokens as CSS custom properties on `:root`.
 * Rendered once in the root layout `<head>`.
 */
export function TokensStyle() {
  return (
    <style
      id="va-tokens"
      // The string is built from our own constants, never from user input.
      dangerouslySetInnerHTML={{ __html: tokensToCssVariables() }}
    />
  );
}
