"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Clarity from "@microsoft/clarity";

type Props = {
  projectId: string;
  userId?: string;
};

export default function ClarityInit({ projectId, userId }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!projectId) return;
    try {
      if (typeof window !== "undefined") {
        const w = window as any;
        if (!w.__clarity_initialized) {
          Clarity.init(projectId);
          w.__clarity_initialized = true;
        }
        if (userId) {
          // Clarity hashes the custom id client-side before sending <mcreference link="https://www.npmjs.com/package/@microsoft/clarity" index="3">3</mcreference>
          Clarity.identify(userId);
        }
      }
    } catch (e) {
      // no-op
    }
    // Re-run on route changes to satisfy Identify API best practice <mcreference link="https://www.npmjs.com/package/@microsoft/clarity" index="3">3</mcreference>
  }, [projectId, userId, pathname]);

  return null;
}