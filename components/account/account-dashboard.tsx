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
import Link from 'next/link'
import { InvoiceHistory, type InvoiceItem } from '@/components/billingsdk/invoice-history'

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
  dodo_payment_id?: string
}

interface SubscriptionSummary {
  subscription_id: string
  status: 'pending' | 'active' | 'cancelled' | 'expired'
  plan_name?: string
  next_billing_date?: string
  cancel_at_period_end?: boolean
  current_period_end?: string
  canceled_at?: string
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


  const mapStatusToInvoice = (status: string): 'paid' | 'refunded' | 'open' | 'void' => {
    const s = (status || '').toLowerCase()
    if (s === 'completed' || s === 'succeeded' || s === 'paid') return 'paid'
    if (s === 'refunded') return 'refunded'
    if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'void') return 'void'
    return 'open'
  }

  const invoices: InvoiceItem[] = (payments || []).map((p) => ({
    id: String(p.dodo_payment_id || p.id),
    date: new Date(p.created_at).toISOString().slice(0, 10),
    amount: formatCurrency(Number(p.amount ?? 0), p.currency || 'USD'),
    status: mapStatusToInvoice(p.status),
    invoiceUrl: p.dodo_payment_id ? `/api/dodopayments/invoices/${encodeURIComponent(p.dodo_payment_id)}` : undefined,
    description: p?.pricing_plan?.name ? `Plan: ${p.pricing_plan.name}` : undefined,
  }))





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
                {subscription.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    Current period ends:{' '}
                    {new Date(subscription.current_period_end).toLocaleString()}
                  </p>
                )}
                {typeof subscription.cancel_at_period_end === 'boolean' &&
                  subscription.cancel_at_period_end && (
                    <p className="text-xs text-amber-600">
                      Cancellation scheduled at period end
                    </p>
                  )}
                {subscription.status === 'cancelled' && (
                  <p className="text-xs text-red-600">
                    {`Cancelled${subscription.canceled_at ? ' on ' + new Date(subscription.canceled_at).toLocaleString() : ''}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  href="/subscribe"
                  className="cursor-pointer px-3 py-2 text-sm bg-stone-900 text-white rounded hover:bg-stone-800"
                >
                  Open billing
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No active subscription found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>
            View and download your billing invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <InvoiceHistory invoices={invoices} />
          ) : (
            <div className="text-sm text-muted-foreground">No invoices available yet.</div>
          )}
        </CardContent>
      </Card>


    </div>
  )
}