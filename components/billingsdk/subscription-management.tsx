"use client";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GlobalCard } from "@/components/ui/global-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrentPlan } from "@/lib/billingsdk-config";
import { cn } from "@/lib/utils";
import {
  CancelSubscriptionDialog,
  type CancelSubscriptionDialogProps,
} from "@/components/billingsdk/cancel-subscription-dialog";
import {
  UpdatePlanDialog,
  type UpdatePlanDialogProps,
} from "@/components/billingsdk/update-plan-dialog";
import type { ReactNode } from "react";

export interface SubscriptionManagementProps {
  className?: string;
  currentPlan: CurrentPlan;
  cancelSubscription: CancelSubscriptionDialogProps;
  updatePlan: UpdatePlanDialogProps;
  hideUpdatePlan?: boolean;
  hideCancelDialog?: boolean;
  dateLabel?: string;
  isPlanEnding?: boolean;
  children?: ReactNode;
}

export function SubscriptionManagement({
  className,
  currentPlan,
  cancelSubscription,
  updatePlan,
  hideUpdatePlan,
  hideCancelDialog,
  dateLabel,
  isPlanEnding,
  children,
}: SubscriptionManagementProps) {
  return (
    <div className={cn("w-full text-left", className)}>
      <GlobalCard contentClassName="p-0">
        <CardHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle className="text-xl font-bold">Current Subscription</CardTitle>
          </div>
          <CardDescription>
            Manage your billing and subscription settings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Active Plan Section - Structural, Monochrome */}
          <div className="rounded-lg border bg-muted/20 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">
                  {currentPlan.plan.title} Plan
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-medium uppercase tracking-wide">
                    {currentPlan.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {currentPlan.price || (currentPlan.type === `monthly`
                      ? `${currentPlan.plan.currency}${currentPlan.plan.monthlyPrice}/month`
                      : currentPlan.type === `yearly`
                        ? `${currentPlan.plan.yearlyPrice}/year`
                        : `${currentPlan.plan.currency}${currentPlan.plan.monthlyPrice}/month`)}
                  </span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {currentPlan.plan.description}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <div className="text-right">
                  <span className="block text-xs font-medium uppercase text-muted-foreground">
                    {dateLabel ?? "Next billing date"}
                  </span>
                  <span className="text-lg font-medium">
                    {currentPlan.nextBillingDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Moved Inside for Prominence */}
            <div className="mt-6 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              {children ? (
                <>{children}</>
              ) : (
                <>
                  {!hideUpdatePlan && (
                    <UpdatePlanDialog
                      {...updatePlan}
                      customTrigger={
                        <Button variant="default" className="w-full sm:w-auto font-semibold shadow-sm">
                          {updatePlan.triggerText || "Change Plan"}
                        </Button>
                      }
                    />
                  )}

                  {!hideCancelDialog && (
                    <CancelSubscriptionDialog
                      {...cancelSubscription}
                      customTrigger={
                        <Button variant="outline" className="w-full sm:w-auto hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                          {cancelSubscription.triggerButtonText || "Cancel Subscription"}
                        </Button>
                      }
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Included Features
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {currentPlan.plan.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border">
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground" />
                  </div>
                  <span className="text-sm font-medium">
                    {feature.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </GlobalCard>
    </div>
  );
}
