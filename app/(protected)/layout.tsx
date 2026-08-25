import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { HeaderUser } from "@/components/dashboard/header-user"
import { DynamicBreadcrumb } from "@/components/dashboard/dynamic-breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { LoadingProvider } from "@/components/loading-provider"
import { SubscriptionProvider } from "@/contexts/subscription-context"
import { NavigationProgress } from "@/components/navigation-progress"
import { requireBrandForDashboard } from "@/actions/onboarding"
import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Script from "next/script"
import { isFounderUser } from "@/lib/founder"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!user) {
    redirect('/login')
  }

  // Defence in depth for the brand gate in proxy.ts. Founder tool routes stay
  // reachable without a personal brand; every other dashboard page does not.
  // If the pathname header is missing, rely on proxy alone rather than
  // accidentally ejecting /founder.
  const pathname = (await headers()).get("x-pathname") || ""
  if (pathname && !pathname.startsWith("/founder")) {
    const brandGate = await requireBrandForDashboard()
    if (!brandGate.allowed) {
      redirect(brandGate.redirectTo || "/onboarding")
    }
  }

  // Fetch subscription status (single query)
  const { data: subscription } = await supabase
    .from('dodo_subscriptions')
    .select('status, dodo_pricing_plans(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const isSubscribed = !!subscription
  const planRelation = subscription?.dodo_pricing_plans as
    | { name?: string | null }
    | { name?: string | null }[]
    | null
    | undefined
  const planName = Array.isArray(planRelation)
    ? planRelation[0]?.name || null
    : planRelation?.name || null

  return (
    <div className="protected-scope">
      <NavigationProgress />
      {/* Checkout return tracking script moved here from root layout to scope it to protected pages */}
      <Script id="ga-checkout-return" strategy="afterInteractive">
        {`
          (function(){
            try {
              if (typeof window === 'undefined') return;
              var sid = localStorage.getItem('dodo_last_checkout_session');
              var purchasedSid = localStorage.getItem('dodo_last_purchase_session');
              var payloadStr = localStorage.getItem('dodo_last_checkout_payload');
              if (sid && sid !== purchasedSid && typeof gtag === 'function') {
                fetch('/api/dodopayments/checkout?session_id=' + sid)
                  .then(function(r){ return r.json(); })
                  .then(function(d){
                    var status = d && d.status;
                    var payload = {};
                    try { payload = payloadStr ? JSON.parse(payloadStr) : {}; } catch(_) {}
                    if (status === 'failed') {
                      gtag('event', 'purchase_failed', Object.assign({ session_id: sid }, payload));
                      try {
                        localStorage.removeItem('dodo_last_checkout_session');
                        localStorage.removeItem('dodo_last_checkout_payload');
                      } catch(_) {}
                    } else if (status === 'pending') {
                      gtag('event', 'checkout_abandoned', Object.assign({ session_id: sid }, payload));
                      try {
                        localStorage.removeItem('dodo_last_checkout_session');
                        localStorage.removeItem('dodo_last_checkout_payload');
                      } catch(_) {}
                    } else if (status === 'completed') {
                      try {
                        localStorage.setItem('dodo_last_purchase_session', sid);
                        localStorage.removeItem('dodo_last_checkout_session');
                        localStorage.removeItem('dodo_last_checkout_payload');
                      } catch(_) {}
                    }
                  })
                  .catch(function(_){ /* ignore */ });
              }
            } catch (e) { /* ignore */ }
          })();
        `}
      </Script>
      <SidebarProvider>
        <AppSidebar
          user={{
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            avatar: user.user_metadata?.avatar_url || "/placeholder-user.jpg",
            id: user.id,
          }}
          isSubscribed={isSubscribed}
          isFounder={isFounderUser(user.id)}
        />
        <SidebarInset className="min-w-0 overflow-x-hidden bg-stone-50/60">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2 px-3 sm:px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <DynamicBreadcrumb />
            </div>
            <div className="shrink-0 px-3 sm:px-4">
              <HeaderUser
                user={{
                  name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  email: user.email || '',
                  avatar: user.user_metadata?.avatar_url || "/placeholder-user.jpg",
                  id: user.id,
                }}
              />
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-3 pb-6 sm:px-4 lg:px-6">
            <SubscriptionProvider isSubscribed={isSubscribed} planName={planName}>
              <LoadingProvider>
                {children}
              </LoadingProvider>
            </SubscriptionProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
