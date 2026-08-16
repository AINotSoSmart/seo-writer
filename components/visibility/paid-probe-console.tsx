"use client"

import { useRouter } from "next/navigation"

import { ProbeConsole } from "@/components/visibility/probe-console"

/** The first measurement is user-started, but only after billing is active. */
export function PaidProbeConsole({ brandId }: { brandId: string }) {
    const router = useRouter()

    return (
        <ProbeConsole
            brandId={brandId}
            onRunStarted={() => undefined}
            onComplete={(runId) => router.push(`/visibility/${runId}`)}
        />
    )
}
