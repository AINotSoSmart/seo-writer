import { createHash } from "crypto"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ClaimAuditButton } from "@/components/audit/ClaimAuditButton"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export const metadata: Metadata = {
    title: "Claim your FlipAEO audit",
    robots: { index: false, follow: false },
}

export default async function ClaimAuditPage({
    params,
}: {
    params: Promise<{ token: string }>
}) {
    const { token } = await params
    if (token.length < 32) notFound()
    const hash = createHash("sha256").update(token).digest("hex")
    const admin = createAdminClient() as any
    const { data: claim } = await admin
        .from("audit_claims")
        .select(
            "expires_at, claimed_at, revoked_at, topical_audits(id, public_token, subject_url, run_status, pool_size, cluster_count, article_count, completed_at)",
        )
        .eq("claim_token_hash", hash)
        .maybeSingle()
    const audit = claim?.topical_audits
    if (
        !claim ||
        !audit ||
        claim.revoked_at ||
        new Date(claim.expires_at).getTime() <= Date.now()
    ) {
        notFound()
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const claimed = Boolean(claim.claimed_at)

    return (
        <main className="min-h-screen bg-stone-50 px-5 py-16">
            <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-8">
                <Link href="/" className="font-serif text-lg">
                    FlipAEO
                </Link>
                <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Prepared evidence audit
                </p>
                <h1 className="mt-2 font-serif text-3xl text-stone-900">
                    {new URL(audit.subject_url).hostname}
                </h1>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                    This immutable run measured {audit.pool_size || 0} observed queries,
                    grouped {audit.article_count || 0} planned articles into{" "}
                    {audit.cluster_count || 0} clusters, and preserved a source URL for each
                    gap claim.
                </p>
                <Link
                    href={`/audit/${audit.public_token}`}
                    className="mt-5 inline-block text-sm font-medium text-stone-900 underline"
                >
                    Review the read-only evidence report
                </Link>

                <div className="mt-8 border-t border-stone-200 pt-6">
                    {claimed ? (
                        <p className="text-sm text-stone-600">
                            This one-time claim link has already been used.
                        </p>
                    ) : user ? (
                        <ClaimAuditButton token={token} />
                    ) : (
                        <Link
                            href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`}
                            className="inline-flex rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
                        >
                            Claim this audit and confirm your buyer questions
                        </Link>
                    )}
                    <p className="mt-3 text-xs text-stone-500">
                        The signed-in email must exactly match the recipient selected by the
                        founder. The link is single-use.
                    </p>
                </div>
            </div>
        </main>
    )
}
