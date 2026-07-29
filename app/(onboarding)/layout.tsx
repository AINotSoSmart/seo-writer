import Image from "next/image"
import { redirect } from "next/navigation"

import { createClient } from "@/utils/supabase/server"

/**
 * Onboarding is intentionally outside the dashboard shell. The user is making
 * one high-consequence setup decision at a time, so dashboard navigation,
 * subscription controls, breadcrumbs, and account actions stay out of view.
 */
export default async function OnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login?next=/onboarding")
    }

    return (
        <div className="min-h-screen bg-stone-50 text-stone-950">
            <header className="border-b border-stone-200/80 bg-white">
                <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8">
                    <div className="flex items-center gap-3" aria-label="FlipAEO">
                        <Image
                            src="/site-logo.png"
                            alt=""
                            width={34}
                            height={34}
                            priority
                        />
                        <div>
                            <p className="text-base font-bold leading-tight">FlipAEO</p>
                            <p className="text-xs text-stone-500">Evidence setup</p>
                        </div>
                    </div>
                    <p className="hidden text-xs font-medium text-stone-500 sm:block">
                        Focused setup · your progress is saved
                    </p>
                </div>
            </header>
            <main>{children}</main>
        </div>
    )
}
