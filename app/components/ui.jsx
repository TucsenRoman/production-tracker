"use client";

/**
 * MOVED — this file only forwards.
 *
 * The primitives now live one per file in `./ui/`, re-exported by
 * `./ui/index.ts`. Node resolves `ui.jsx` ahead of `ui/index`, so this shim
 * exists purely so nothing broke on the way. Deleting it (which
 * `cleanup-after-reorg.cmd` does) hands every `from ".../components/ui"`
 * straight to the folder, unchanged.
 */
export * from "./ui/index";
