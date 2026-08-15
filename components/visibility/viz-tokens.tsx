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
 * Declared under both `prefers-color-scheme` and `[data-theme]` so the app's
 * theme toggle wins in both directions.
 */

export const VIZ_TOKENS_CSS = `
.viz-root {
  color-scheme: light;
  --viz-surface: #fcfcfb;
  --viz-plane: #f9f9f7;
  --viz-ink: #0b0b0b;
  --viz-ink-secondary: #52514e;
  --viz-ink-muted: #898781;
  --viz-hairline: #e1e0d9;
  --viz-baseline: #c3c2b7;
  --viz-track: #ebeae3;

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

@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    color-scheme: dark;
    --viz-surface: #1a1a19;
    --viz-plane: #0d0d0d;
    --viz-ink: #ffffff;
    --viz-ink-secondary: #c3c2b7;
    --viz-ink-muted: #898781;
    --viz-hairline: #2c2c2a;
    --viz-baseline: #383835;
    --viz-track: #2c2c2a;

    --viz-series-1: #3987e5;
    --viz-series-2: #d95926;
    --viz-muted-mark: #4d4d49;

    --viz-seq-200: #184f95;
    --viz-seq-350: #256abf;
    --viz-seq-450: #3987e5;
    --viz-seq-550: #6da7ec;

    --viz-good: #0ca30c;
    --viz-good-ink: #0ca30c;
    --viz-warning: #fab219;
    --viz-warning-ink: #fab219;
    --viz-critical: #d03b3b;
  }
}

:root[data-theme="dark"] .viz-root {
  color-scheme: dark;
  --viz-surface: #1a1a19;
  --viz-plane: #0d0d0d;
  --viz-ink: #ffffff;
  --viz-ink-secondary: #c3c2b7;
  --viz-ink-muted: #898781;
  --viz-hairline: #2c2c2a;
  --viz-baseline: #383835;
  --viz-track: #2c2c2a;

  --viz-series-1: #3987e5;
  --viz-series-2: #d95926;
  --viz-muted-mark: #4d4d49;

  --viz-seq-200: #184f95;
  --viz-seq-350: #256abf;
  --viz-seq-450: #3987e5;
  --viz-seq-550: #6da7ec;

  --viz-good: #0ca30c;
  --viz-good-ink: #0ca30c;
  --viz-warning: #fab219;
  --viz-warning-ink: #fab219;
  --viz-critical: #d03b3b;
}

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
