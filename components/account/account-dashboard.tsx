'use client'

import { useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { User as UserIcon, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cancelSubscription, updatePaymentMethod } from '@/lib/dodopayments'

// Removed complex credit transaction service dependency

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  credits: number
  created_at: string
  completed_at?: string
  pricing_plan: {
    name: string
    price: number
  }
}

interface SubscriptionSummary {
  subscription_id: string
  status: 'pending' | 'active' | 'cancelled' | 'expired'
  plan_name?: string
  next_billing_date?: string
  cancel_at_period_end?: boolean
}

interface AccountDashboardProps {
  user: User
  payments: Payment[]
  currentCredits: number
  totalCreditsPurchased: number
  subscription?: SubscriptionSummary | null
}

interface UsageStats {
  totalSpent: number
  thisMonth: number
  lastMonth: number
  topFeatures: Array<{ feature: string; credits: number }>
}

export function AccountDashboard({ user, payments, currentCredits, totalCreditsPurchased, subscription }: AccountDashboardProps) {




  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }



  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            See your personal information and account settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="text-lg">
                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-medium">
                {user.user_metadata?.full_name || 'User'}
              </h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                Member since {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email || ''} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      subscription.status === 'active'
                        ? 'default'
                        : subscription.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {subscription.status}
                  </Badge>
                  <span className="text-sm font-medium">
                    {subscription.plan_name || 'Subscription'}
                  </span>
                </div>
                {subscription.next_billing_date && (
                  <p className="text-sm text-muted-foreground">
                    Next billing:{' '}
                    {new Date(subscription.next_billing_date).toLocaleString()}
                  </p>
                )}
                {typeof subscription.cancel_at_period_end === 'boolean' &&
                  subscription.cancel_at_period_end && (
                    <p className="text-xs text-amber-600">
                      Cancellation scheduled at period end
                    </p>
                  )}
              </div>
              <div className="flex gap-2">
                <button
                  className=" cursor-pointer px-3 py-2 text-sm bg-stone-900 text-white rounded hover:bg-stone-800 disabled:opacity-50"
                  onClick={useCallback(async () => {
                    try {
                      const res = await updatePaymentMethod(
                        subscription?.subscription_id,
                        `${process.env.NEXT_PUBLIC_APP_URL}/account`
                      )
                      if (res?.url) {
                        window.location.href = res.url
                      } else if (res?.emailed) {
                        alert(res?.message || 'We emailed you a secure link to update your payment method.')
                      } else {
                        alert('Unable to open payment method portal.')
                      }
                    } catch (e) {
                      console.error('Failed to open payment method portal', e)
                      alert('Failed to open payment method portal')
                    }
                  }, [subscription?.subscription_id])}
                >
                  Update payment method
                </button>

                {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                  <button
                    className=" cursor-pointer px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
                    onClick={useCallback(async () => {
                      try {
                        await cancelSubscription(subscription?.subscription_id)
                        // Optimistic UX: reflect cancel-at-period-end immediately
                        window.location.reload()
                      } catch (e) {
                        console.error('Failed to cancel subscription', e)
                        alert('Failed to cancel subscription')
                      }
                    }, [subscription?.subscription_id])}
                  >
                    Cancel at period end
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No active subscription found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Purchases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Credit Purchases
          </CardTitle>
          <CardDescription>
            View your credit purchase history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <div className="space-y-4">
              {payments.slice(0, 20).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={payment.status === 'completed' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'}>
                        {payment.status}
                      </Badge>
                      <span className="text-sm font-medium">{payment.pricing_plan.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(payment.amount, payment.currency)} for {payment.credits.toLocaleString()} credits
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium text-green-600">
                      +{payment.credits.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(payment.amount, payment.currency)}
                    </p>
                  </div>
                </div>
              ))}
              {payments.length > 20 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing 20 of {payments.length} purchases
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Transactions</h3>
              <p className="text-muted-foreground">
                Your credit transaction history will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}