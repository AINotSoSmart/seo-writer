export function founderUserIds(): Set<string> {
    return new Set(
        (process.env.FOUNDER_USER_IDS || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    )
}

export function isFounderUser(userId: string): boolean {
    return founderUserIds().has(userId)
}
