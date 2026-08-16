"use client"

import * as React from "react"
import {
  Send,
  Layers3,
  Search,
  Sparkles,
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

function ProgramCard({ isSubscribed, planName }: { isSubscribed?: boolean; planName?: string | null }) {
  return (
    <Card className="py-2">
      <CardContent className="gap-1 flex flex-col px-3">
        <div className="text-sm font-medium mb-1">Delivery program</div>
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Layers3 className="h-3 w-3" />
          {isSubscribed ? `${planName || "Active"} velocity` : "Program not purchased"}
        </div>
        {isSubscribed ? (
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link href="/subscribe" prefetch={false}>
              Manage Billing
            </Link>
          </Button>
        ) : (
          <Button size="sm" className="w-full bg-black hover:bg-black/90 text-white border-0" asChild>
            <Link href="/audit" prefetch={false}>
              Review audit
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
      title: "AI Visibility",
      url: "/visibility",
      icon: Sparkles,
    },
    {
      title: "Evidence Audit",
      url: "/audit",
      icon: Search,
    },
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
    // Product navigation follows measurement evidence into recurring delivery cycles.
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
                  <span className="truncate text-xs">Cluster Delivery</span>
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
        <ProgramCard isSubscribed={isSubscribed} planName={planName} />
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}

