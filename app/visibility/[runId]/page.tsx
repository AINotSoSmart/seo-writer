/**
 * Retired public entry point for the AI-visibility report.
 *
 * This route used to render the whole report for anyone holding the run id: it
 * read `ai_probe_runs` through the admin client, which bypasses RLS, and used
 * the signed-in user only to decide which call-to-action to show. `user_id` was
 * selected and never compared. The result was a link-shareable report of a
 * customer's buyer questions, competitors and cluster plan, protected by
 * nothing but the length of a UUID.
 *
 * There is exactly one report surface now — `/visibility`, inside the dashboard
 * shell, resolved from the signed-in user's own newest completed run. This path
 * survives only so that links already handed out (onboarding's final redirect,
 * the paid probe console, anything a customer bookmarked) still land somewhere
 * correct: it verifies ownership and forwards. It renders nothing itself.
 *
 * Do not restore a body to this page. A second renderer for the same report is
 * a second place for an authorization check to be forgotten.
 */

import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

interface PageProps {
    params: Promise<{ runId: string }>
}

export default async function VisibilityRunRedirectPage({ params }: PageProps) {
    const { runId } = await params

    const userClient = await createClient()
    const {
        data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
        redirect(`/login?next=${encodeURIComponent(`/visibility/${runId}`)}`)
    }

    // Ownership is still checked even though the destination shows the caller's
    // own run regardless. Confirming that a run id exists is a disclosure in
    // itself, so a non-owner gets the same answer as someone guessing.
    const admin = createAdminClient() as any
    const { data: run } = await admin
        .from("ai_probe_runs")
        .select("id, user_id")
        .eq("id", runId)
        .maybeSingle()
    if (!run || run.user_id !== user.id) notFound()

    redirect("/visibility")
}
