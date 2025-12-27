"use client"

import * as React from "react"
import {
  Send,
  Brain,
  Coins,
  Sparkles,
  Image as ImageIcon,
  DatabaseZap,
  Sparkles as SparklesIcon,
  Settings,
  NotebookPen,
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
import { createClient } from "@/utils/supabase/client"
import { CustomSpinner } from "@/components/CustomSpinner"


const navSecondary = [
  {
    title: "Support",
    url: "mailto:support@drawgle.com",
    icon: Send,
  },
]

// Credits Card Component
function CreditsCard({ userId }: { userId?: string }) {
  const { balance, loading } = useCreditManager(userId || null)

  if (loading) {
    return (
      <Card className="mb-4 py-2">
        <CardContent className="p-3">
          <div className="text-sm font-medium mb-1">Plan Usage</div>
          <div className="w-full min-h-screen flex items-center justify-center">
            <CustomSpinner className="w-10 h-10" />
          </div>
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
          <span className="flex items-center gap-2"><Coins className="h-3 w-3" />Credits</span> <span className="text-amber-600"> {balance.toLocaleString()}</span>
        </div>
        <Button size="sm" className="w-full bg-black hover:bg-black/90 text-white border-0" asChild>
          <Link href="/subscribe">
            <Sparkles className="h-3 w-3" /> Subscribe
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: {
    name: string
    email: string
    avatar: string
    id?: string
  }
}) {
  const userData = user || {
    name: "User",
    email: "user@example.com",
    avatar: "/placeholder-user.jpg",
  }

  const supabase = createClient()

  const navItems = React.useMemo(() => [
    {
      title: "Dashboard",
      url: "/content-plan",
      icon: NotebookPen,
      isActive: true,
    },
    {
      title: "Articles",
      url: "/articles",
      icon: SparklesIcon,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
    {
      title: "Integrations",
      url: "/integrations",
      icon: DatabaseZap,
    },
    {
      title: "Content Plan",
      url: "/content-plan",
      icon: Brain,
    },

  ], [])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <Image src="/site-logo.png" alt="Unrealshot AI" width={30} height={30} className="rounded-sm" />
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
        <CreditsCard userId={userData.id} />
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
