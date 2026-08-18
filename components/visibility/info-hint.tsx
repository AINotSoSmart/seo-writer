"use client"

/**
 * The explanation that used to be a paragraph.
 *
 * WHY NOT A TOOLTIP. Radix `Tooltip` opens on hover and focus only. Every
 * screenshot of this report so far has been Android Chrome, where hover does
 * not exist — a tooltip would have hidden the explanation on the one device the
 * founder actually reads it on. So this is a Popover: it opens on tap, on
 * click, and on keyboard focus everywhere, and *additionally* on hover when the
 * pointer is a real mouse. "Hover tooltip" on desktop, working control on a
 * phone.
 *
 * WHY IT EXISTS AT ALL. Every section of this report carried a paragraph of
 * standing explanation — what "named" means, why surfaces are not averaged, why
 * a losing question is not automatically an article. All of it is true and none
 * of it changes between runs, so it was re-read on every visit and pushed the
 * numbers below the fold. General information is reference material: available
 * on demand, never occupying the first screen.
 *
 * The trigger is a real `<button>` with an accessible name, so the content is
 * reachable by keyboard and announced by a screen reader rather than being
 * decoration next to a heading.
 */

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

export function InfoHint({
    label,
    children,
    className,
    align = "start",
}: {
    /** Names what is being explained, for screen readers: "What 'named' means". */
    label: string
    children: React.ReactNode
    className?: string
    align?: "start" | "center" | "end"
}) {
    const [open, setOpen] = React.useState(false)

    // Hover is an enhancement, never the only way in. `pointerType` is checked
    // because a touch tap also emits pointerenter — without the guard the panel
    // would open on hover and immediately toggle again on the click that
    // follows, which reads as a flicker on a phone.
    const hoverProps = {
        onPointerEnter: (event: React.PointerEvent) => {
            if (event.pointerType === "mouse") setOpen(true)
        },
        onPointerLeave: (event: React.PointerEvent) => {
            if (event.pointerType === "mouse") setOpen(false)
        },
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    className={cn(
                        "inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-[var(--viz-ink-muted)] transition hover:text-[var(--viz-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-series-1)]",
                        className,
                    )}
                    {...hoverProps}
                >
                    <Info className="size-3.5" aria-hidden />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align={align}
                    sideOffset={6}
                    collisionPadding={12}
                    /**
                     * `viz-root` is not decoration — it is what makes this
                     * readable.
                     *
                     * Radix renders content in a Portal at `document.body`,
                     * which is OUTSIDE the `.viz-root` element that declares
                     * `--viz-surface`, `--viz-ink` and the rest. Referencing
                     * those variables here resolved them to nothing, so the
                     * panel painted with no background at all and the report
                     * showed straight through the text. Re-declaring the tokens
                     * on the panel itself is what fixes it; a portal has to
                     * carry its own scope.
                     *
                     * `max-w` rather than a fixed width: these render inside a
                     * 375px viewport as often as a desktop one.
                     */
                    className="viz-root z-50 max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-3.5 text-xs leading-relaxed text-[var(--viz-ink-secondary)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.28)] outline-none ring-1 ring-black/5 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
                    {...hoverProps}
                >
                    {children}
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    )
}

/**
 * A section heading with its explanation folded into a hint.
 *
 * One component so the pairing cannot drift: every heading that had a paragraph
 * under it gets the same affordance in the same place, and a new section cannot
 * quietly reintroduce a wall of standing text.
 */
export function SectionHeading({
    title,
    hintLabel,
    hint,
    children,
}: {
    title: string
    hintLabel?: string
    hint?: React.ReactNode
    /** Optional trailing content, e.g. a filter control, right-aligned. */
    children?: React.ReactNode
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-xl font-semibold text-[var(--viz-ink)]">
                {title}
                {hint && <InfoHint label={hintLabel ?? `About ${title}`}>{hint}</InfoHint>}
            </h2>
            {children}
        </div>
    )
}
