import "react";

/**
 * Inline styles set CSS custom properties in several places (AppShell's
 * `--app-mobile-header-h`, the nav rows' `--row-bg`). React passes them
 * through fine, but `CSSProperties` only lists known properties, so each one
 * would otherwise need a cast at the call site.
 */
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
