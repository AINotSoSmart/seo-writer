/**
 * Dates that render identically on the server and in the browser.
 *
 * WHY THIS EXISTS. `new Date(x).toLocaleDateString()` with no arguments asks
 * the *host* for its locale and timezone. Node and the browser answer
 * differently — measured on this machine, the server said `17/8/2026` (en-IN)
 * and the browser said `8/17/2026` (en-US) for the same instant. React compares
 * server HTML against the client render, finds different text, and **hydration
 * fails**.
 *
 * A failed hydration is not a cosmetic bug. React never attaches, so every
 * client handler on the page is dead: tabs do not switch, popovers do not open,
 * the losing/all filter does nothing and the question rows do not expand. The
 * page looks completely normal and is completely inert, which is the worst
 * possible failure mode because nothing on screen says so.
 *
 * The visibility report is a client component rendered from a server component,
 * so every date it prints has to be host-independent. Locale and timezone are
 * both pinned: fixing the locale alone still lets a server in a different zone
 * render the previous day.
 *
 * UTC is the honest zone here — a probe is timestamped when it ran, and the
 * report already says answers vary by place, so quietly reinterpreting the
 * instant in the reader's local zone would add a difference it never explains.
 */

const DATE = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
})

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
})

function parse(value: string | number | Date): Date | null {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

/** "Aug 17, 2026" — identical on every host. */
export function formatRunDate(value: string | number | Date): string {
    const date = parse(value)
    return date ? DATE.format(date) : "—"
}

/** "Aug 17, 2026, 09:00 UTC" — identical on every host. */
export function formatRunDateTime(value: string | number | Date): string {
    const date = parse(value)
    return date ? `${DATE_TIME.format(date)} UTC` : "—"
}
