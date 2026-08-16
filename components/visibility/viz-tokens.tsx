/**
 * Chart tokens for the visibility dashboard.
 *
 * The palette is the validated default from the data-viz method, not a set of
 * colours chosen by eye. Both modes were run through the six checks against the
 * surfaces below and pass every hard gate:
 *
 *   light  #2a78d6 / #eb6834 — adjacent CVD ΔE 24.7, normal-vision ΔE 33.6
 *   dark   #3987e5 / #d95926 — adjacent CVD ΔE 26.8, normal-vision ΔE 31.8
 *
 * The dark column is the same two hues re-stepped for the dark surface — a
 * selected palette, not an automatic flip. Status colours are fixed and never
 * themed; on the light surface `warning` sits below 3:1 by design, which is why
 * every status in this dashboard ships an icon and a text label and never
 * carries meaning by colour alone.
 *
 * Light only, matching the rest of the product — see the note above the
 * `.viz-bar` rules for why the dark column was removed rather than kept.
 */

export const VIZ_TOKENS_CSS = `
.viz-root {
  color-scheme: light;
  /* Stone, matching every other dashboard page: surface = white cards on a
     stone-50 plane, ink = stone-900/600/400, hairline = stone-200. */
  --viz-surface: #ffffff;
  --viz-plane: #fafaf9;
  --viz-ink: #1c1917;
  --viz-ink-secondary: #57534e;
  --viz-ink-muted: #a8a29e;
  --viz-hairline: #e7e5e4;
  --viz-baseline: #d6d3d1;
  --viz-track: #f5f5f4;

  /* categorical: slot 1 = the brand, slot 2 = everyone else */
  --viz-series-1: #2a78d6;
  --viz-series-2: #eb6834;
  /* de-emphasis: context marks in an emphasis chart */
  --viz-muted-mark: #c3c2b7;

  /* sequential ramp, one hue, light -> dark */
  --viz-seq-200: #9ec5f4;
  --viz-seq-350: #5598e7;
  --viz-seq-450: #2a78d6;
  --viz-seq-550: #1c5cab;

  /* status — fixed, never themed */
  --viz-good: #0ca30c;
  --viz-good-ink: #006300;
  --viz-warning: #fab219;
  --viz-warning-ink: #7a5200;
  --viz-critical: #d03b3b;
}

/* No dark branch, deliberately.

   This dashboard is the only surface in the product that ever had one. Every
   other page is stone-on-white with no dark: variants and no theme toggle, so
   honouring prefers-color-scheme meant the report inverted to near-black on a
   dark-OS machine while the sidebar beside it stayed light — the report read as
   a different product bolted on. A palette that follows the system when its
   host does not is not theme support; it is one page disagreeing with the app.

   Restore the dark column from git history if a real app-wide dark mode ever
   lands; the values were selected for the dark surface rather than flipped, so
   they are worth recovering rather than re-deriving. */

/* Data-ends: 4px rounded at the value end, square at the baseline. */
.viz-bar {
  border-radius: 0 4px 4px 0;
  height: 10px;
}
.viz-track {
  background: var(--viz-track);
  border-radius: 0 4px 4px 0;
  height: 10px;
}
`

export function VizTokens() {
    return <style dangerouslySetInnerHTML={{ __html: VIZ_TOKENS_CSS }} />
}
