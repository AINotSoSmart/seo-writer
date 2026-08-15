import Image from "next/image"
import { redirect } from "next/navigation"
import { LogOut } from "lucide-react"

import { signOut } from "@/app/auth/signout/actions"
import { createClient } from "@/utils/supabase/server"

/**
 * Onboarding is intentionally outside the dashboard shell. Floating controls
 * provide a safe exit without introducing a second navigation/header system.
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

    async function handleSignOut(): Promise<void> {
        "use server"
        await signOut()
    }

    return (
        <div className="relative min-h-screen bg-stone-50 text-stone-950">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
                <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-5 sm:px-8">
                    <div
                        className="pointer-events-auto flex items-center gap-2.5"
                        aria-label="FlipAEO"
                    >
                        <Image
                            src="/site-logo.png"
                            alt=""
                            width={32}
                            height={32}
                            priority
                        />
                        <div>
                            <p className="text-base font-bold leading-tight">FlipAEO</p>
                            <p className="text-[11px] text-stone-500">Onboarding</p>
                        </div>
                    </div>

                    <div className="pointer-events-auto flex items-center gap-1 sm:gap-2">
                        
                        <form action={handleSignOut}>
                            <button
                                type="submit"
                                className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-stone-500 transition-colors hover:bg-white/80 hover:text-stone-950 sm:px-4 sm:text-sm"
                            >
                                <LogOut className="size-3.5" />
                                <span className="hidden sm:inline">Log out</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <main className="pt-20">{children}</main>
        </div>
    )
}
