import { task } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { getGscDataByDateRange } from "@/lib/gsc"
import { subDays, format, eachDayOfInterval } from "date-fns"
import { decryptToken, encryptToken } from "@/lib/encryption"

// Helper to refresh Google OAuth token
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error("Missing Google Client ID/Secret")
        return null
    }

    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error("Failed to refresh Google token:", error)
            return null
        }

        const data = await response.json()
        return data.access_token
    } catch (e) {
        console.error("Token refresh exception:", e)
        return null
    }
}

interface GSCSyncPayload {
    userId: string
    siteUrl: string
    connectionId: string
    isInitialSync?: boolean
}

export const syncGscDataTask = task({
    id: "sync-gsc-data",
    maxDuration: 300, // 5 minutes max as GSC API can be slow
    run: async (payload: GSCSyncPayload) => {
        console.log(`[GSC Sync Worker] Starting sync for ${payload.siteUrl} (User: ${payload.userId})`)
        const supabase = createAdminClient() as any

        // 1. Fetch connection details
        const { data: connection, error: connError } = await supabase
            .from("gsc_connections")
            .select("access_token, refresh_token")
            .eq("id", payload.connectionId)
            .single()

        if (connError || !connection) {
            console.error(`[GSC Sync Worker] Connection not found or DB error:`, connError)
            return { success: false, error: "Connection not found" }
        }

        let accessToken = decryptToken(connection.access_token)

        // 2. Refresh the token utilizing the refresh_token to avoid 1-hr expiry issues over 30 days
        if (connection.refresh_token) {
            console.log(`[GSC Sync Worker] Exchanging refresh token for new access token...`)
            const decryptedRefreshToken = decryptToken(connection.refresh_token)
            const newAccessToken = await refreshGoogleToken(decryptedRefreshToken)
            if (newAccessToken) {
                accessToken = newAccessToken
                // Store encrypted refreshed access token back to DB
                await supabase
                    .from("gsc_connections")
                    .update({ access_token: encryptToken(newAccessToken), updated_at: new Date().toISOString() })
                    .eq("id", payload.connectionId)
            } else {
                console.warn(`[GSC Sync Worker] Token exchange failed. Proceeding with existing access token (may fail).`)
            }
        }

        // 3. Define 60-day historical window.
        // The GSC data is usually delayed by 2-3 days, so we start from 3 days ago.
        const today = new Date()
        const endDate = subDays(today, 3)
        const startDate = subDays(today, 62) // approx 60 days
        
        const startDateStr = format(startDate, 'yyyy-MM-dd')
        const endDateStr = format(endDate, 'yyyy-MM-dd')

        console.log(`[GSC Sync Worker] Fetching SearchAnalytics query from ${startDateStr} to ${endDateStr}...`)

        try {
            // 4. Extract data from Google
            const newRows = await getGscDataByDateRange(accessToken, payload.siteUrl, startDateStr, endDateStr)
            
            console.log(`[GSC Sync Worker] Received ${newRows.length} raw rows from GSC API. Processing & sorting...`)
            
            // 5. Group by date and clean up
            const rowsByDate = new Map<string, any[]>()
            
            newRows.forEach((row: any) => {
                const date = row.keys[0] // dimensions: ['date', 'query', 'page']
                if (!rowsByDate.has(date)) {
                    rowsByDate.set(date, [])
                }
                rowsByDate.get(date)!.push(row)
            })

            // 6. Injection: Upsert to Supabase Daily Cache
            let totalRowsSaved = 0
            
            for (const [date, rows] of Array.from(rowsByDate.entries())) {
                // Sort by highest clicks and cap at 1000 max rows per day to protect DB storage sizes
                const limitedRows = rows.sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 1000)
                
                const { error: upsertError } = await supabase
                    .from('gsc_daily_cache')
                    .upsert({
                        user_id: payload.userId,
                        site_url: payload.siteUrl,
                        date: date,
                        data: limitedRows
                    }, {
                        onConflict: 'user_id,site_url,date'
                    })

                if (upsertError) {
                    console.error(`[GSC Sync Worker] Failed to insert data for ${date}:`, upsertError)
                } else {
                    totalRowsSaved += limitedRows.length
                }
            }

            console.log(`[GSC Sync Worker] Successfully cached ${rowsByDate.size} days, total ${totalRowsSaved} rows.`)

            // 7. Chronological Lock Phase
            // Update last_fetched_at to act as the 30-day unmodifiable chronological lock
            const { error: lockError } = await supabase
                .from("gsc_connections")
                .update({ last_fetched_at: new Date().toISOString() })
                .eq("id", payload.connectionId)
                
            if (lockError) {
                console.error(`[GSC Sync Worker] Failed to update chronological lock for connection:`, lockError)
            } else {
                console.log(`[GSC Sync Worker] Chronological lock (last_fetched_at) updated. Job Complete.`)
            }

            return { 
                success: true, 
                syncedDays: rowsByDate.size,
                rowsSaved: totalRowsSaved
            }

        } catch (error: any) {
            console.error(`[GSC Sync Worker] GSC API Fetch failed:`, error)
            return { success: false, error: error.message || "GSC API failed" }
        }
    }
})
