import { createClient } from '@/utils/supabase/server'
import Image from 'next/image'
import { cookies } from 'next/headers'
import SubscribeButton from '@/components/subscribe/SubscribeButton'
import ManageSubscription from '@/components/subscribe/ManageSubscription'
import { Check, ChevronUp, Loader2, Sparkles, Zap } from 'lucide-react'

function formatPrice(value: number | string, currency: string) {
    const n = typeof value === 'number' ? value : Number(value || 0)
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
    } catch {
        return `$${n.toFixed(2)}`
    }
}

type PlanRow = {
    id: string
    name: string
    description: string | null
    price: number
    credits: number | null
    currency: string | null
    dodo_product_id: string
}

async function getPlans(): Promise<PlanRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('dodo_pricing_plans')
        .select('id, name, description, price, credits, currency, dodo_product_id')
        .eq('is_active', true)
        .order('price', { ascending: true })
    if (error) return []
    return (data || []) as PlanRow[]
}

async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

async function getLatestSubscription(userId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('dodo_subscriptions')
        .select('dodo_subscription_id, status, pricing_plan_id, next_billing_date, cancel_at_period_end, current_period_end, canceled_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error) return null
    return data
}

export default async function SubscribePage() {
    // Touch cookies to enable RSC auth context
    await cookies()
    const [plans, user] = await Promise.all([getPlans(), getUser()])

    // If user is available, try pulling their latest subscription
    let subscriptionSummary: {
        subscription_id: string
        status: 'pending' | 'active' | 'cancelled' | 'expired'
        plan_name?: string
        next_billing_date?: string
        cancel_at_period_end?: boolean
        current_period_end?: string
        canceled_at?: string
    } | null = null

    if (user) {
        const row = await getLatestSubscription(user.id)
        if (row?.dodo_subscription_id) {
            const planName = plans.find(p => p.id === (row as any).pricing_plan_id)?.name
            // Normalize status
            const rawStatus = String(row.status || '').toLowerCase()
            const status = (rawStatus === 'active'
                ? 'active'
                : rawStatus === 'pending'
                    ? 'pending'
                    : rawStatus === 'cancelled' || rawStatus === 'canceled'
                        ? 'cancelled'
                        : 'expired') as 'pending' | 'active' | 'cancelled' | 'expired'

            subscriptionSummary = {
                subscription_id: row.dodo_subscription_id,
                status,
                plan_name: planName || undefined,
                next_billing_date: row.next_billing_date || undefined,
                cancel_at_period_end: !!row.cancel_at_period_end,
                current_period_end: row.current_period_end || undefined,
                canceled_at: row.canceled_at || undefined,
            }
        }
    }

    // If user has an active subscription, show management instead of checkout
    if (subscriptionSummary?.status === 'active') {
        return (
            <main className="min-h-screen font-sans text-stone-900 flex flex-col items-center py-8 px-4 sm:px-6">
                <div className="w-full max-w-5xl">
                    <ManageSubscription
                        subscription={subscriptionSummary}
                        plans={plans}
                        userEmail={user?.email || null}
                    />
                </div>
            </main>
        )
    }

    // Otherwise, render subscribe/checkout UI (marketing + CTA)
    const plan = plans?.[0]

    return (
        <main className="min-h-screen font-sans text-stone-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6">

            {/* ISLAND CARD CONTAINER */}
            <div className={`
                relative w-full max-w-2xl p-1.5 rounded-[24px] 
                bg-stone-100 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0px_1px_2px_rgba(0,0,0,0.04)]
                transition-all duration-300
            `}>
                {/* Top Notch Decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-6 z-20 flex justify-center pointer-events-none">
                    <div className="w-10 h-4 rounded-b-lg border-b border-x bg-stone-100 border-stone-200/60 flex items-center justify-center">
                        <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                </div>

                {/* Inner White Card */}
                <div className="relative border border-stone-200 bg-white rounded-[20px] overflow-hidden">

                    {/* Header Section */}
                    <div className="text-center pt-10 pb-6 border-b border-stone-100 px-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 mb-4">
                            <Sparkles className="w-3.5 h-3.5 text-stone-600 fill-stone-600/20" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">Early Bird Pricing</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mb-3">
                            Stop publishing generic fluff.
                        </h1>
                        <p className="text-stone-500 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                            Get the only AI that researches like an expert and writes in <i>your</i> voice.
                            <br className="hidden sm:block" />
                            Start ranking with content that actually converts.
                        </p>
                    </div>

                    {/* Content Section */}
                    {plan ? (
                        <div className="p-6 sm:p-8">

                            {/* Price Block */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-bold tracking-tighter text-stone-900">
                                        {formatPrice(plan.price, plan.currency ?? 'USD')}
                                    </span>
                                    <span className="text-stone-400 font-medium">/mo</span>
                                </div>
                                <p className="text-xs text-stone-400 mt-2 font-medium bg-stone-50 px-3 py-1 rounded-full border border-stone-100">
                                    Include {plan.credits ?? 0} article credits
                                </p>
                            </div>

                            {/* Features Grid */}
                            <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 mb-8 max-w-lg mx-auto text-left">
                                <FeatureItem text="Deep Research Agent" />
                                <FeatureItem text="Brand Voice Cloning" />
                                <FeatureItem text="Auto-Internal Linking" />
                                <FeatureItem text="Verified Real Citations" />
                                <FeatureItem text="WordPress/Webflow Sync" />
                                <FeatureItem text="Cancel anytime" />
                            </div>

                            {/* Button Section */}
                            <div className="max-w-xs mx-auto flex flex-col items-center">
                                <SubscribeButton
                                    productId={plan.dodo_product_id}
                                    isAuthenticated={!!user}
                                    className="
                    cursor-pointer w-full sm:w-full h-12 rounded-xl text-base font-semibold text-white shadow-lg
                    bg-gradient-to-b from-stone-800 to-stone-950
                    hover:from-stone-700 hover:to-stone-900
                    shadow-[0_0_1px_1px_rgba(255,255,255,0.08)_inset,0_1px_1.5px_0_rgba(0,0,0,0.32)]
                    active:scale-[0.98] transition-all
                  "
                                >
                                    <span className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 fill-white/20" />
                                        Subscribe to Pro
                                    </span>
                                </SubscribeButton>
                                <p className="text-center text-[10px] text-stone-400 mt-3 font-medium">
                                    30 articles/mo · No lock-in · 14-day money-back guarantee
                                </p>
                            </div>

                        </div>
                    ) : (
                        <div className="p-12 text-center text-stone-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                            <p>Loading plan...</p>
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="bg-stone-50/50 border-t border-stone-100 p-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">

                        <div className="flex items-center gap-2 hover:grayscale-60 transition-all">
                            <Image src="/dodo-logo.png" alt="dodopayments" width={96} height={96} className="inline-block ml-1 bg-black" />
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Secure payments by Dodo Payments</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom FAQ Links (Subtle) */}
            <div className="mt-8 flex gap-6 text-xs text-stone-400 font-medium">
                <p>Fully secure payment processing.</p>
            </div>

        </main>
    )
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-stone-900 flex-shrink-0" strokeWidth={3} />
            <span className="text-sm text-stone-700 font-medium">{text}</span>
        </div>
    )
}