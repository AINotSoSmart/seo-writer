import { notFound } from "next/navigation"

import { ProspectAuditRunner } from "@/components/founder/ProspectAuditRunner"
import { isFounderUser } from "@/lib/founder"
import { createClient } from "@/utils/supabase/server"

export default async function ProspectAuditsPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isFounderUser(user.id)) notFound()

    return (
        <main className="mx-auto w-full max-w-5xl py-6">
            <header className="mb-7">
                <h1 className="font-serif text-3xl text-stone-900">Prospect audits</h1>
                <p className="mt-2 text-sm text-stone-600">
                    Queue immutable audits without using or replacing your customer brand slot.
                    Claim links are email-bound, single-use, and expire after 30 days.
                </p>
            </header>
            <ProspectAuditRunner />
        </main>
    )
}
