"use client"

import { useFormStatus } from "react-dom"
import { ArrowRight, Loader2 } from "lucide-react"

export function GscSubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-black text-stone-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold rounded-lg transition-colors cursor-pointer"
        >
            {pending ? (
                <>
                    Connecting <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </>
            ) : (
                <>
                    Select <ArrowRight className="w-3.5 h-3.5" />
                </>
            )}
        </button>
    )
}
