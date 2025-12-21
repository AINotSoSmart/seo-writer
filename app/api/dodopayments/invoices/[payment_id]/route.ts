import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDodoClient } from '@/lib/dodopayments-server'

/**
 * GET /api/dodopayments/invoices/:payment_id
 * Secure PDF proxy for invoice download.
 *
 * Security:
 * - Requires authenticated Supabase user
 * - Verifies the requested payment_id belongs to the current user in public.dodo_payments
 * - Streams PDF from Dodo Payments and returns as application/pdf
 *
 * Docs:
 * - Dodo Invoice PDF: https://docs.dodopayments.com/api-reference/payments/get-invoice
 *   GET /invoices/payments/{payment_id}
 */
export async function GET(_req: NextRequest, ctx: { params: { payment_id: string } }) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rawParam = ctx?.params?.payment_id || ''
        const payment_id = decodeURIComponent(rawParam)

        if (!payment_id) {
            return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 })
        }

        // Ownership check: the dodo_payment_id must belong to this user
        const { data: owned } = await supabase
            .from('dodo_payments')
            .select('user_id')
            .eq('dodo_payment_id', payment_id)
            .maybeSingle()

        if (!owned || owned.user_id !== user.id) {
            // Avoid leaking existence; respond 404
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const client = getDodoClient()
        const resp: Response = await client.invoices.payments.retrieve(payment_id)

        if (!resp || (resp as any).status >= 400) {
            const status = (resp as any)?.status || 502
            return NextResponse.json({ error: 'Failed to fetch invoice PDF' }, { status })
        }

        // Convert to Buffer for NextResponse
        const ab = await (resp as any).arrayBuffer()
        const buf = Buffer.from(ab)

        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="invoice_${payment_id}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Failed to download invoice' }, { status: 500 })
    }
}