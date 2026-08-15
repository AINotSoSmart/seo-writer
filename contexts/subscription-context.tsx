"use client"

import { createContext, useContext, ReactNode } from "react"

type SubscriptionContextType = {
    isSubscribed: boolean
    planName: string | null
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isSubscribed: false,
    planName: null,
})

export function SubscriptionProvider({
    children,
    isSubscribed,
    planName,
}: { children: ReactNode } & SubscriptionContextType) {
    return (
        <SubscriptionContext.Provider value={{ isSubscribed, planName }}>
            {children}
        </SubscriptionContext.Provider>
    )
}

export function useSubscription() {
    return useContext(SubscriptionContext)
}
