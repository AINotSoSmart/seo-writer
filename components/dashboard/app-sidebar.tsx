"use client"

import * as React from "react"
import {
  Send,
  Sparkles,
  Target,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { NavMain } from "@/components/dashboard/nav-main"
import { NavSecondary } from "@/components/dashboard/nav-secondary"
import { NavUser } from "@/components/dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useCreditManager } from "@/lib/credit-manager"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Custom animated icons
import { BookTextIcon } from "@/components/icons/book-text"
import { FeatherIcon } from "@/components/icons/feathericon"
import { SyringeIcon } from "@/components/icons/syringe"
import { SettingsIcon } from "@/components/icons/settings"
import { WebhookIcon } from "@/components/icons/webhook"


const navSecondary = [
  {
    title: "Support",
    url: "mailto:support@flipaeo.com",
    icon: Send,
  },
]

// Credits Card Component
function CreditsCard({ userId, isSubscribed, planName }: { userId?: string; isSubscribed?: boolean; planName?: string | null }) {
  const { balance, loading } = useCreditManager(userId || null)

  if (loading) {
    return (
      <Card className="mb-4 py-2">
        <CardContent className="p-3">
          <div className="text-sm font-medium mb-1">Plan Usage</div>
          <div className="text-xs text-muted-foreground mb-3 justify-between">Loading...</div>
          <div className="w-full h-8 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-2">
      <CardContent className="gap-1 flex flex-col px-3">
        <div className="text-sm font-medium mb-1">Plan Usage</div>
        <div className="text-xs text-muted-foreground mb-3 flex justify-between">
          <span className="flex items-center gap-2"><FeatherIcon size={12} />Articles</span> <span className="text-amber-600"> {balance.toLocaleString()}</span>
        </div>
        {isSubscribed ? (
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link href="/subscribe" prefetch={false}>
              Manage Billing
            </Link>
          </Button>
        ) : (
          <Button size="sm" className="w-full bg-black hover:bg-black/90 text-white border-0" asChild>
            <Link href="/subscribe" prefetch={false}>
              <Sparkles className="h-3 w-3" /> Subscribe
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function AppSidebar({
  user,
  isSubscribed,
  planName,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: {
    name: string
    email: string
    avatar: string
    id?: string
  }
  isSubscribed?: boolean
  planName?: string | null
}) {
  const userData = user || {
    name: "User",
    email: "user@example.com",
    avatar: "/placeholder-user.jpg",
  }

  const navItems = React.useMemo(() => [
    {
      title: "Content Plan",
      url: "/content-plan",
      icon: BookTextIcon,
      isActive: true,
    },
    {
      title: "Articles",
      url: "/articles",
      icon: FeatherIcon,
    },
    // ARCHIVED — "SEO Health" and "Action Board" are hidden, not deleted.
    // They were a GSC tracking product bolted onto a writing product, nobody
    // paid for either, and their content pulled the site's own SEO toward
    // rank-tracking queries that could never convert. Routes and code remain
    // under app/(protected)/ in case an agency asks for GSC reporting later.
    {
      title: "Settings",
      url: "/settings",
      icon: SettingsIcon,
    },
    {
      title: "Integrations",
      url: "/integrations",
      icon: WebhookIcon,
    },


  ], [])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" prefetch={false}>
                <Image src="/site-logo.png" alt="FlipAEO AI" width={30} height={30} className="rounded-sm" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">FlipAEO</span>
                  <span className="truncate text-xs">AI SEO Writer</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <CreditsCard userId={userData.id} isSubscribed={isSubscribed} planName={planName} />
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}

