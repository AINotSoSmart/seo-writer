'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { SubscriptionManagement } from '@/components/billingsdk/subscription-management'
import {
    cancelSubscription as apiCancelSubscription,
    restoreSubscription as apiRestoreSubscription,
    changeSubscriptionPlan as apiChangePlan,
    updatePaymentMethod as apiUpdatePaymentMethod,
} from '@/lib/dodopayments'
import type { Plan as BSDKPlan, CurrentPlan as BSDKCurrentPlan } from '@/lib/billingsdk-config'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { useRouter } from 'next/navigation'
import { createClient as createSupabaseClient } from '@/utils/supabase/client'

type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired'

export interface SubscriptionSummary {
    subscription_id: string
    status: SubscriptionStatus
    plan_name?: string
    next_billing_date?: string
    cancel_at_period_end?: boolean
    current_period_end?: string
    canceled_at?: string
    price_snapshot?: number | null
    currency_snapshot?: string | null
}

export interface PlanRow {
    id: string
    name: string
    description?: string | null
    price: number
    currency?: string | null
    dodo_product_id: string
}

interface ManageSubscriptionProps {
    subscription: SubscriptionSummary
    plans: PlanRow[]
    userEmail?: string | null
}

function currencySymbol(code?: string | null): string {
    if (!code) return '$'
    const c = code.toUpperCase()
    switch (c) {
        case 'USD': return '$'
        case 'EUR': return '€'
        case 'GBP': return '£'
        case 'INR': return '₹'
        case 'AUD': return 'A$'
        case 'CAD': return 'C$'
        case 'JPY': return '¥'
        default: return '$'
    }
}

export default function ManageSubscription({
    subscription,
    plans,
}: ManageSubscriptionProps) {
    const [busy, setBusy] = useState(false)
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
    const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)
    const router = useRouter()
    const [localCancelAtPeriodEnd, setLocalCancelAtPeriodEnd] = useState(!!subscription.cancel_at_period_end)
    const [localNextBillingDate, setLocalNextBillingDate] = useState<string | undefined>(subscription.next_billing_date)
    const [localCurrentPeriodEnd, setLocalCurrentPeriodEnd] = useState<string | undefined>(subscription.current_period_end)
    const cancelGuardDate = useMemo(
        () => localCurrentPeriodEnd ?? localNextBillingDate,
        [localCurrentPeriodEnd, localNextBillingDate]
    )
    const cancelDescription = useMemo(() => {
        return (
            `This will schedule your subscription to cancel at the end of the current billing period.` +
            (cancelGuardDate ? ` You will retain access until ${new Date(cancelGuardDate).toLocaleString()}.` : '') +
            ` You can restore anytime before that date.`
        )
    }, [cancelGuardDate])

    // Map pricing plans to BillingSDK Plan type
    const billingPlans = useMemo<BSDKPlan[]>(() => {
        return (plans || []).map((p) => ({
            id: p.id,
            title: p.name,
            description: p.description || '',
            currency: currencySymbol(p.currency || 'USD'),
            monthlyPrice: String(p.price ?? 0),
            yearlyPrice: String((p.price ?? 0) * 12),
            buttonText: 'Select',
            features: [
                { name: '40 tracked buyer questions', icon: 'check' },
                { name: 'ChatGPT and Google AI Mode measurement', icon: 'check' },
                { name: 'Up to eight create or refresh actions per cycle', icon: 'check' },
                { name: 'One complete draft batch', icon: 'check' },
                { name: 'Visible findings and backlog', icon: 'check' },
            ],
        }))
    }, [plans])

    // Determine current plan display
    const currentPlanDisplay = useMemo(() => {
        const byName = billingPlans.find((bp) => bp.title === subscription.plan_name)
        return byName || billingPlans[0]
    }, [billingPlans, subscription.plan_name])

    const nextBillingDateStr = useMemo(() => {
        return localNextBillingDate ? new Date(localNextBillingDate).toLocaleDateString() : '—'
    }, [localNextBillingDate])

    const planEndsDateStr = useMemo(() => {
        return localCurrentPeriodEnd
            ? new Date(localCurrentPeriodEnd).toLocaleDateString()
            : (localNextBillingDate ? new Date(localNextBillingDate).toLocaleDateString() : '—')
    }, [localCurrentPeriodEnd, localNextBillingDate])

    const dateLabel = localCancelAtPeriodEnd ? 'Plan ends on' : 'Next billing date'

    const currentPlanInfo = useMemo<BSDKCurrentPlan>(() => {
        let sym = currentPlanDisplay?.currency || '$'
        let priceStr = currentPlanDisplay ? `${sym}${currentPlanDisplay.monthlyPrice}/month` : '—'

        if (subscription.price_snapshot != null) {
            const snapCurrency = subscription.currency_snapshot || 'USD'
            sym = currencySymbol(snapCurrency)
            const amt = subscription.price_snapshot / 100 // assuming price_snapshot is in cents
            priceStr = `${sym}${amt}/month`
        }

        const status: BSDKCurrentPlan['status'] =
            subscription.status === 'active'
                ? 'active'
                : subscription.status === 'pending'
                    ? 'inactive'
                    : subscription.status === 'cancelled'
                        ? 'cancelled'
                        : 'inactive'

        return {
            plan: currentPlanDisplay || {
                id: 'default',
                title: subscription.plan_name || 'Plan',
                description: '',
                currency: '$',
                monthlyPrice: '0',
                yearlyPrice: '0',
                buttonText: 'Select',
                features: [],
            },
            type: 'monthly',
            price: priceStr,
            nextBillingDate: localCancelAtPeriodEnd ? planEndsDateStr : nextBillingDateStr,
            paymentMethod: 'Card on file',
            status,
        }
    }, [currentPlanDisplay, subscription.status, subscription.price_snapshot, subscription.currency_snapshot, nextBillingDateStr, planEndsDateStr, localCancelAtPeriodEnd, subscription.plan_name])

    const onCancel = useCallback(async () => {
        if (!subscription.subscription_id) return
        try {
            setBusy(true)
            const res = await apiCancelSubscription(subscription.subscription_id)
            setLocalCancelAtPeriodEnd(true)
            if (res?.remote?.current_period_end) {
                setLocalCurrentPeriodEnd(res.remote.current_period_end as any)
            }
            if (res?.remote?.next_billing_date) {
                setLocalNextBillingDate(res.remote.next_billing_date as any)
            }
            setConfirmCancelOpen(false)
            router.refresh()
        } finally {
            setBusy(false)
        }
    }, [subscription.subscription_id, router])

    const onRestore = useCallback(async () => {
        if (!subscription.subscription_id) return
        try {
            setBusy(true)
            await apiRestoreSubscription(subscription.subscription_id)
            setLocalCancelAtPeriodEnd(false)
            router.refresh()
        } finally {
            setBusy(false)
        }
    }, [subscription.subscription_id, router])

    const onPlanChange = useCallback(async (planId: string) => {
        const chosen = plans.find((p) => p.id === planId)
        if (!chosen || !subscription.subscription_id) return
        try {
            setBusy(true)
            await apiChangePlan(subscription.subscription_id, chosen.dodo_product_id, 'prorated_immediately', 1)
            // Webhook will update local state; reflect without hard reload
            router.refresh()
        } finally {
            setBusy(false)
        }
    }, [plans, subscription.subscription_id, router])

    const onUpdatePaymentMethod = useCallback(async () => {
        try {
            setBusy(true)
            const origin = typeof window !== 'undefined' ? window.location.origin : ''
            const return_url = `${origin}/subscribe?pm_updated=1`
            const res = await apiUpdatePaymentMethod(subscription.subscription_id, return_url)
            if (res?.url) {
                window.location.href = res.url
            } else if (res?.emailed) {
                alert(res?.message || 'We emailed you a secure link to update your payment method.')
            } else {
                alert('Unable to open payment method update flow.')
            }
        } catch (e) {
            console.error('Update payment method failed', e)
            alert('Failed to open payment method update')
        } finally {
            setBusy(false)
        }
    }, [subscription.subscription_id])

    // Realtime: reflect webhook updates without hard refresh
    useEffect(() => {
        if (!subscription.subscription_id) return
        const supabase = createSupabaseClient()
        const channel = supabase
            .channel(`dodo_subscriptions:${subscription.subscription_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'dodo_subscriptions',
                    filter: `dodo_subscription_id=eq.${subscription.subscription_id}`,
                } as any,
                (payload: any) => {
                    const row = (payload?.new ?? {}) as any
                    if (typeof row.cancel_at_period_end !== 'undefined') {
                        setLocalCancelAtPeriodEnd(!!row.cancel_at_period_end)
                    }
                    if ('next_billing_date' in row) {
                        setLocalNextBillingDate(row.next_billing_date || undefined)
                    }
                    if ('current_period_end' in row) {
                        setLocalCurrentPeriodEnd(row.current_period_end || undefined)
                    }
                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            try { supabase.removeChannel(channel) } catch (_) { }
        }
    }, [subscription.subscription_id, router])




    return (
        <div className="mx-auto flex w-full flex-col gap-8">


            {/* Subscription Management (Plan change + Cancel dialog) */}
            <div id="subscription-management-section">
                <SubscriptionManagement
                    className="w-full"
                    currentPlan={currentPlanInfo}
                    cancelSubscription={{
                        title: 'Cancel Subscription',
                        description:
                            'This will schedule your subscription to cancel at the end of the current billing period. You will retain access until the end of the period.',
                        plan: currentPlanInfo.plan,
                        triggerButtonText: 'Cancel Subscription',
                        onCancel: async () => onCancel(),
                        onKeepSubscription: async () => onRestore(),
                    }}
                    updatePlan={{
                        currentPlan: currentPlanInfo.plan,
                        plans: billingPlans,
                        triggerText: 'Change Plan',
                        onPlanChange: (planId: string) => onPlanChange(planId),
                    }}
                    hideUpdatePlan={true}
                    hideCancelDialog={true}
                    dateLabel={dateLabel}
                    isPlanEnding={localCancelAtPeriodEnd}
                >
                    <>
                        {subscription.status === 'active' && !localCancelAtPeriodEnd && (
                            <Button
                                variant="destructive"
                                onClick={() => setConfirmCancelOpen(true)}
                                disabled={busy}
                            >
                                Cancel at period end
                            </Button>
                        )}
                        {subscription.status === 'active' && localCancelAtPeriodEnd && (
                            <Button
                                variant="default"
                                onClick={() => setConfirmRestoreOpen(true)}
                                disabled={busy}
                            >
                                Restore subscription
                            </Button>
                        )}
                        <Button variant="outline" onClick={onUpdatePaymentMethod} disabled={busy}>
                            Update payment method
                        </Button>
                    </>
                </SubscriptionManagement>
            </div>


            <ConfirmationDialog
                isOpen={confirmCancelOpen}
                onClose={() => setConfirmCancelOpen(false)}
                onConfirm={async () => {
                    try {
                        await onCancel()
                    } catch (e) {
                        console.error('Failed to cancel subscription', e)
                        alert('Failed to cancel subscription')
                    }
                }}
                title="Confirm cancellation at period end"
                description={cancelDescription}
                confirmText="Confirm cancellation"
                cancelText="Keep subscription"
                variant="destructive"
            />

            <ConfirmationDialog
                isOpen={confirmRestoreOpen}
                onClose={() => setConfirmRestoreOpen(false)}
                onConfirm={async () => {
                    try {
                        await onRestore()
                        setConfirmRestoreOpen(false)
                    } catch (e) {
                        console.error('Failed to restore subscription', e)
                        alert('Failed to restore subscription')
                    }
                }}
                title="Restore your subscription?"
                description="Your subscription will continue and you will be billed on the next billing date. Your access will remain uninterrupted."
                confirmText="Yes, restore subscription"
                cancelText="Cancel"
                variant="default"
            />

        </div>
    )
}
