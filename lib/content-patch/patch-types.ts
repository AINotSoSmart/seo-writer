export type PatchOperation =
    | "replace_section"
    | "insert_after"
    | "insert_before"
    | "delete_section"

export interface SectionChange {
    operation: PatchOperation
    sectionId: string
    reason: string
    newHeading?: string
    newContent: string
    opportunityIds?: string[]
}

export interface ContentPatch {
    targetUrl: string
    sourceHash: string
    changes: SectionChange[]
    mergedDocumentHtml: string
    mergedDocumentMarkdown: string
}
