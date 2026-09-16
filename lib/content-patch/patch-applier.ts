import { slugifySectionId } from "./content-document.ts"
import type { ContentDocument, ContentSection } from "./content-document.ts"
import type { ContentPatch, SectionChange } from "./patch-types.ts"


/**
 * Applies a list of structured SectionChanges deterministically onto a ContentDocument.
 * Untouched sections are preserved byte-for-byte.
 */
export function applySectionChanges(
    doc: ContentDocument,
    changes: SectionChange[],
): ContentPatch {
    // Deep clone sections so the original document remains immutable
    const sections: ContentSection[] = doc.sections.map((sec) => ({ ...sec }))

    for (const change of changes) {
        const index = sections.findIndex((s) => s.id === change.sectionId)

        if (change.operation === "delete_section") {
            if (index !== -1) {
                sections.splice(index, 1)
            }
            continue
        }

        const heading = change.newHeading || (index !== -1 ? sections[index].heading : "Additional Details")
        const level = index !== -1 && sections[index].level > 0 ? sections[index].level : 2
        const rawHtml = `<h${level}>${heading}</h${level}>\n${change.newContent}`
        const newSec: ContentSection = {
            id: slugifySectionId(heading, sections.length),
            heading,
            level,
            text: change.newContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            rawHtml,
        }

        if (change.operation === "replace_section") {
            if (index !== -1) {
                sections[index] = newSec
            } else {
                sections.push(newSec)
            }
        } else if (change.operation === "insert_after") {
            if (index !== -1) {
                sections.splice(index + 1, 0, newSec)
            } else {
                sections.push(newSec)
            }
        } else if (change.operation === "insert_before") {
            if (index !== -1) {
                sections.splice(index, 0, newSec)
            } else {
                sections.unshift(newSec)
            }
        }
    }

    const mergedDocumentHtml = sections.map((s) => s.rawHtml).filter(Boolean).join("\n\n")
    const mergedDocumentMarkdown = sections
        .map((s) => {
            const hashes = "#".repeat(Math.max(1, s.level || 2))
            return `${hashes} ${s.heading}\n\n${s.text}`
        })
        .join("\n\n")

    return {
        targetUrl: doc.url,
        sourceHash: doc.sourceHash,
        changes,
        mergedDocumentHtml,
        mergedDocumentMarkdown,
    }
}
