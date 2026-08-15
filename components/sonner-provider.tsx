"use client"

import { Toaster as SonnerToaster } from "sonner"

export function SonnerProvider() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        duration: 5000,
        className: "sonner-toast",
      }}
    />
  )
}
