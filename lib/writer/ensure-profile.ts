/**
 * `articles.user_id` references `profiles(id)`, not `auth.users`. Signup
 * normally creates the profile via trigger, but founder/test accounts created
 * outside that path can exist in auth without a matching profile row.
 */
export async function ensureProfileRow(
    db: any,
    userId: string,
    email?: string | null,
): Promise<void> {
    const { data: existing } = await db
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle()
    if (existing) return

    const { error } = await db.from("profiles").insert({
        id: userId,
        email: email || "",
    })
    if (error) {
        throw new Error(`Could not create profile row: ${error.message}`)
    }
}
