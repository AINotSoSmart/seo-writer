import type { ContentDocument } from "../content-document.ts"
import type { ContentPatch } from "../patch-types.ts"

export interface PublishResult {
    success: boolean
    postUrl?: string
    postId?: number | string
    error?: string
}

export interface PublishingAdapter {
    canHandle(targetUrl: string): Promise<boolean>
    fetchExisting(targetUrl: string): Promise<ContentDocument>
    applyPatch(target: ContentDocument, patch: ContentPatch): Promise<PublishResult>
}
