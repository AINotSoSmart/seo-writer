'use client'

import React, { useCallback, useMemo, useState } from 'react'
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

type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired'

export interface SubscriptionSummary {
    subscription_id: string
    status: SubscriptionStatus
    plan_name?: string
    next_billing_date?: string
    cancel_at_period_end?: boolean
    current_period_end?: string
    canceled_at?: string
}

export interface PlanRow {
    id: string
    name: string
    description?: string | null
    price: number
    credits?: number | null
    currency?: string | null
    dodo_product_id: string
}

interface ManageSubscriptionProps {
    subscription: SubscriptionSummary
    plans: PlanRow[]
    userEmail?: string | null
}

function formatCurrency(amount: number, currency: string = 'USD') {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    } catch {
        // Fallback
        return `$${(amount || 0).toFixed(2)}`
    }
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

function daysUntil(dateIso?: string): number {
    if (!dateIso) return 0
    const now = new Date()
    const d = new Date(dateIso)
    const diff = Math.max(0, d.getTime() - now.getTime())
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function ManageSubscription({ subscription, plans, userEmail }: ManageSubscriptionProps) {
    const [busy, setBusy] = useState(false)
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
    const cancelGuardDate = subscription?.current_period_end || subscription?.next_billing_date
    const cancelDescription =
        `This will schedule your subscription to cancel at the end of the current billing period.` +
        (cancelGuardDate ? ` You will retain access until ${new Date(cancelGuardDate).toLocaleString()}.` : '') +
        ` You can restore anytime before that date.`

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
                { name: p.credits ? `Includes ${p.credits} credits / mo` : 'Standard features', icon: 'check' },
                { name: 'Cancel anytime', icon: 'check' },
            ],
        }))
    }, [plans])

    // Determine current plan display
    const currentPlanDisplay = useMemo(() => {
        const byName = billingPlans.find((bp) => bp.title === subscription.plan_name)
        return byName || billingPlans[0]
    }, [billingPlans, subscription.plan_name])

    const nextBillingDateStr = useMemo(() => {
        return subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString() : '—'
    }, [subscription.next_billing_date])

    const currentPlanInfo = useMemo<BSDKCurrentPlan>(() => {
        const sym = currentPlanDisplay?.currency || '$'
        const priceStr = currentPlanDisplay ? `${sym}${currentPlanDisplay.monthlyPrice}/month` : '—'
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
            nextBillingDate: nextBillingDateStr,
            paymentMethod: 'Card on file',
            status,
        }
    }, [currentPlanDisplay, subscription.status, nextBillingDateStr, subscription.plan_name])

    const onCancel = useCallback(async () => {
        if (!subscription.subscription_id) return
        try {
            setBusy(true)
            await apiCancelSubscription(subscription.subscription_id)
            window.location.reload()
        } finally {
            setBusy(false)
        }
    }, [subscription.subscription_id])

    const onRestore = useCallback(async () => {
        if (!subscription.subscription_id) return
        try {
            setBusy(true)
            await apiRestoreSubscription(subscription.subscription_id)
            window.location.reload()
        } finally {
            setBusy(false)
        }
    }, [subscription.subscription_id])

    const onPlanChange = useCallback(async (planId: string) => {
        const chosen = plans.find((p) => p.id === planId)
        if (!chosen || !subscription.subscription_id) return
        try {
            setBusy(true)
            await apiChangePlan(subscription.subscription_id, chosen.dodo_product_id, 'prorated_immediately', 1)
            // Webhook will update local state; reload to reflect
            window.location.reload()
        } finally {
            setBusy(false)
        }
    }, [plans, subscription.subscription_id])

    const onUpdatePaymentMethod = useCallback(async () => {
        try {
            setBusy(true)
            const origin = typeof window !== 'undefined' ? window.location.origin : ''
            const return_url = `${origin}/subscribe`
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




    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">


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
                >
                    <>
                        {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                            <Button
                                variant="destructive"
                                onClick={() => setConfirmCancelOpen(true)}
                                disabled={busy}
                            >
                                Cancel at period end
                            </Button>
                        )}
                        {subscription.status === 'active' && subscription.cancel_at_period_end && (
                            <Button
                                variant="default"
                                onClick={onRestore}
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
                        await apiCancelSubscription(subscription?.subscription_id)
                        window.location.reload()
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

        </div>
    )
}