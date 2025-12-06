"use client"

import { useState, useEffect } from "react"
import { GlobalCard } from "@/components/ui/global-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    getWordPressConnections,
    addWordPressConnection,
    deleteWordPressConnection,
    setDefaultConnection
} from "@/actions/wordpress"
import {
    getWebflowConnections,
    testWebflowToken,
    getWebflowCollections,
    addWebflowConnection,
    deleteWebflowConnection,
    setDefaultWebflowConnection
} from "@/actions/webflow"
import { toast } from "sonner"
import { Plus, Trash2, ExternalLink, Check, Loader2, Globe, Lock, User, Key, ChevronDown } from "lucide-react"

// Types
interface WordPressConnection {
    id: string
    site_url: string
    site_name: string | null
    username: string
    is_default: boolean
    created_at: string
}

interface WebflowConnection {
    id: string
    site_name: string | null
    site_id: string
    collection_id: string
    is_default: boolean
    created_at: string
}

interface WebflowSite {
    id: string
    displayName: string
}

interface WebflowCollection {
    id: string
    displayName: string
    slug: string
}

export default function IntegrationsPage() {
    // WordPress state
    const [wpConnections, setWpConnections] = useState<WordPressConnection[]>([])
    const [showWpForm, setShowWpForm] = useState(false)
    const [wpSubmitting, setWpSubmitting] = useState(false)
    const [wpSiteUrl, setWpSiteUrl] = useState("")
    const [wpUsername, setWpUsername] = useState("")
    const [wpAppPassword, setWpAppPassword] = useState("")

    // Webflow state
    const [wfConnections, setWfConnections] = useState<WebflowConnection[]>([])
    const [showWfForm, setShowWfForm] = useState(false)
    const [wfSubmitting, setWfSubmitting] = useState(false)
    const [wfApiToken, setWfApiToken] = useState("")
    const [wfSites, setWfSites] = useState<WebflowSite[]>([])
    const [wfSelectedSite, setWfSelectedSite] = useState<WebflowSite | null>(null)
    const [wfCollections, setWfCollections] = useState<WebflowCollection[]>([])
    const [wfSelectedCollection, setWfSelectedCollection] = useState<WebflowCollection | null>(null)
    const [wfStep, setWfStep] = useState<1 | 2 | 3>(1) // 1: token, 2: site, 3: collection

    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadConnections()
    }, [])

    const loadConnections = async () => {
        const [wpResult, wfResult] = await Promise.all([
            getWordPressConnections(),
            getWebflowConnections()
        ])

        if (!wpResult.error) setWpConnections(wpResult.connections)
        if (!wfResult.error) setWfConnections(wfResult.connections)
        setLoading(false)
    }

    // WordPress handlers
    const handleWpSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
            toast.error("Please fill in all fields")
            return
        }

        setWpSubmitting(true)
        const result = await addWordPressConnection({
            siteUrl: wpSiteUrl,
            username: wpUsername,
            appPassword: wpAppPassword
        })
        setWpSubmitting(false)

        if (result.success) {
            toast.success(`Connected to ${result.siteName || wpSiteUrl}`)
            setWpSiteUrl("")
            setWpUsername("")
            setWpAppPassword("")
            setShowWpForm(false)
            loadConnections()
        } else {
            toast.error(result.error || "Failed to connect")
        }
    }

    const handleWpDelete = async (id: string) => {
        const result = await deleteWordPressConnection(id)
        if (result.success) {
            toast.success("Connection removed")
            loadConnections()
        } else {
            toast.error(result.error || "Failed to remove")
        }
    }

    const handleWpSetDefault = async (id: string) => {
        const result = await setDefaultConnection(id)
        if (result.success) {
            toast.success("Default updated")
            loadConnections()
        }
    }

    // Webflow handlers
    const handleWfTestToken = async () => {
        if (!wfApiToken) {
            toast.error("Please enter API token")
            return
        }

        setWfSubmitting(true)
        const result = await testWebflowToken(wfApiToken)
        setWfSubmitting(false)

        if (result.success && result.sites) {
            setWfSites(result.sites)
            setWfStep(2)
            toast.success("Token verified!")
        } else {
            toast.error(result.error || "Invalid token")
        }
    }

    const handleWfSelectSite = async (site: WebflowSite) => {
        setWfSelectedSite(site)
        setWfSubmitting(true)

        const result = await getWebflowCollections(wfApiToken, site.id)
        setWfSubmitting(false)

        if (result.collections.length > 0) {
            setWfCollections(result.collections)
            setWfStep(3)
        } else {
            toast.error("No CMS collections found in this site")
        }
    }

    const handleWfSelectCollection = async (collection: WebflowCollection) => {
        setWfSelectedCollection(collection)
        setWfSubmitting(true)

        const result = await addWebflowConnection({
            apiToken: wfApiToken,
            siteId: wfSelectedSite!.id,
            siteName: wfSelectedSite!.displayName,
            collectionId: collection.id,
        })
        setWfSubmitting(false)

        if (result.success) {
            toast.success("Webflow connected!")
            resetWfForm()
            loadConnections()
        } else {
            toast.error(result.error || "Failed to connect")
        }
    }

    const resetWfForm = () => {
        setShowWfForm(false)
        setWfApiToken("")
        setWfSites([])
        setWfSelectedSite(null)
        setWfCollections([])
        setWfSelectedCollection(null)
        setWfStep(1)
    }

    const handleWfDelete = async (id: string) => {
        const result = await deleteWebflowConnection(id)
        if (result.success) {
            toast.success("Connection removed")
            loadConnections()
        }
    }

    const handleWfSetDefault = async (id: string) => {
        const result = await setDefaultWebflowConnection(id)
        if (result.success) {
            toast.success("Default updated")
            loadConnections()
        }
    }

    if (loading) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
        )
    }

    return (
        <div className="w-full min-h-screen font-sans">
            <GlobalCard className="w-full shadow-sm rounded-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-stone-200/50 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/40 backdrop-blur-sm rounded-t-xl">
                    <h1 className="text-base md:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                        Integrations
                    </h1>
                </div>

                <div className="p-4 md:p-6 space-y-8">
                    {/* WordPress Section */}
                    <IntegrationSection
                        title="WordPress"
                        description="Publish articles directly to your WordPress site"
                        iconBg="#21759b"
                        icon={<svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.5 16.5l-3-9h1.5l2 6 2-6H14l-3 9h-0.5zm6.5-9c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5 1.5-.672 1.5-1.5-.672-1.5-1.5-1.5z" /></svg>}
                        showForm={showWpForm}
                        onShowForm={() => setShowWpForm(true)}
                        connections={wpConnections}
                        renderForm={
                            <form onSubmit={handleWpSubmit} className="mb-6 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="wpSiteUrl" className="text-sm font-medium flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-stone-400" />
                                            WordPress Site URL
                                        </Label>
                                        <Input
                                            id="wpSiteUrl"
                                            type="url"
                                            placeholder="https://yoursite.com"
                                            value={wpSiteUrl}
                                            onChange={(e) => setWpSiteUrl(e.target.value)}
                                            className="h-10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="wpUsername" className="text-sm font-medium flex items-center gap-2">
                                            <User className="w-4 h-4 text-stone-400" />
                                            WordPress Username
                                        </Label>
                                        <Input
                                            id="wpUsername"
                                            type="text"
                                            placeholder="admin"
                                            value={wpUsername}
                                            onChange={(e) => setWpUsername(e.target.value)}
                                            className="h-10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="wpAppPassword" className="text-sm font-medium flex items-center gap-2">
                                            <Lock className="w-4 h-4 text-stone-400" />
                                            Application Password
                                        </Label>
                                        <Input
                                            id="wpAppPassword"
                                            type="password"
                                            placeholder="xxxx xxxx xxxx xxxx"
                                            value={wpAppPassword}
                                            onChange={(e) => setWpAppPassword(e.target.value)}
                                            className="h-10"
                                            required
                                        />
                                        <p className="text-xs text-stone-500">
                                            Generate in WordPress → Users → Profile → Application Passwords
                                        </p>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button type="submit" disabled={wpSubmitting} className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white dark:bg-white dark:text-stone-900">
                                            {wpSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Testing...</> : <><Check className="w-4 h-4 mr-1.5" />Test & Connect</>}
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={() => setShowWpForm(false)} className="h-9">Cancel</Button>
                                    </div>
                                </div>
                            </form>
                        }
                        renderConnections={wpConnections.map((conn) => (
                            <ConnectionCard
                                key={conn.id}
                                name={conn.site_name || conn.site_url}
                                subtitle={conn.site_url}
                                isDefault={conn.is_default}
                                iconBg="#21759b"
                                onSetDefault={() => handleWpSetDefault(conn.id)}
                                onOpen={() => window.open(conn.site_url, '_blank')}
                                onDelete={() => handleWpDelete(conn.id)}
                            />
                        ))}
                        emptyText="No WordPress sites connected yet"
                    />

                    {/* Webflow Section */}
                    <IntegrationSection
                        title="Webflow"
                        description="Publish articles to your Webflow CMS collections"
                        iconBg="#4353ff"
                        icon={<svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor"><path d="M17.802 8.56s-1.946 6.066-2.097 6.53c-.046-.49-.8-6.53-.8-6.53h-4.293s-.645 6.11-.706 6.54c-.147-.452-1.992-6.54-1.992-6.54H4l4.06 10.88h4.04s.7-5.7.76-6.29c.04.59.8 6.29.8 6.29h4.04L22 8.56h-4.198z" /></svg>}
                        showForm={showWfForm}
                        onShowForm={() => setShowWfForm(true)}
                        connections={wfConnections}
                        renderForm={
                            <div className="mb-6 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                                {/* Step indicator */}
                                <div className="flex items-center gap-2 mb-4 text-xs text-stone-500">
                                    <span className={wfStep >= 1 ? "text-stone-900 dark:text-white font-medium" : ""}>1. API Token</span>
                                    <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                                    <span className={wfStep >= 2 ? "text-stone-900 dark:text-white font-medium" : ""}>2. Select Site</span>
                                    <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                                    <span className={wfStep >= 3 ? "text-stone-900 dark:text-white font-medium" : ""}>3. Select Collection</span>
                                </div>

                                {wfStep === 1 && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="wfApiToken" className="text-sm font-medium flex items-center gap-2">
                                                <Key className="w-4 h-4 text-stone-400" />
                                                Webflow API Token
                                            </Label>
                                            <Input
                                                id="wfApiToken"
                                                type="password"
                                                placeholder="Your Webflow API token"
                                                value={wfApiToken}
                                                onChange={(e) => setWfApiToken(e.target.value)}
                                                className="h-10"
                                            />
                                            <p className="text-xs text-stone-500">
                                                Generate in Webflow → Project Settings → Integrations → API Access
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={handleWfTestToken} disabled={wfSubmitting} className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white dark:bg-white dark:text-stone-900">
                                                {wfSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Verifying...</> : <>Continue</>}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={resetWfForm} className="h-9">Cancel</Button>
                                        </div>
                                    </div>
                                )}

                                {wfStep === 2 && (
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">Select a Site</Label>
                                        {wfSites.map((site) => (
                                            <button
                                                key={site.id}
                                                onClick={() => handleWfSelectSite(site)}
                                                disabled={wfSubmitting}
                                                className="w-full p-3 text-left rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                                            >
                                                <span className="font-medium text-stone-900 dark:text-white">{site.displayName}</span>
                                            </button>
                                        ))}
                                        <Button type="button" variant="ghost" onClick={resetWfForm} className="h-9 mt-2">Cancel</Button>
                                    </div>
                                )}

                                {wfStep === 3 && (
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">Select Blog Collection</Label>
                                        <p className="text-xs text-stone-500 -mt-2">Choose the CMS collection where articles will be published</p>
                                        {wfCollections.map((col) => (
                                            <button
                                                key={col.id}
                                                onClick={() => handleWfSelectCollection(col)}
                                                disabled={wfSubmitting}
                                                className="w-full p-3 text-left rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                                            >
                                                <span className="font-medium text-stone-900 dark:text-white">{col.displayName}</span>
                                                <span className="text-xs text-stone-500 ml-2">/{col.slug}</span>
                                            </button>
                                        ))}
                                        <Button type="button" variant="ghost" onClick={resetWfForm} className="h-9 mt-2">Cancel</Button>
                                    </div>
                                )}
                            </div>
                        }
                        renderConnections={wfConnections.map((conn) => (
                            <ConnectionCard
                                key={conn.id}
                                name={conn.site_name || conn.site_id}
                                subtitle={`Collection: ${conn.collection_id}`}
                                isDefault={conn.is_default}
                                iconBg="#4353ff"
                                onSetDefault={() => handleWfSetDefault(conn.id)}
                                onDelete={() => handleWfDelete(conn.id)}
                            />
                        ))}
                        emptyText="No Webflow sites connected yet"
                    />

                    {/* More integrations */}
                    <div className="border-t border-stone-200 dark:border-stone-800 pt-6">
                        <p className="text-sm text-stone-500 text-center">
                            More integrations coming soon (Ghost, Shopify, Medium...)
                        </p>
                    </div>
                </div>
            </GlobalCard>
        </div>
    )
}

// Reusable components
function IntegrationSection({
    title,
    description,
    iconBg,
    icon,
    showForm,
    onShowForm,
    connections,
    renderForm,
    renderConnections,
    emptyText,
}: {
    title: string
    description: string
    iconBg: string
    icon: React.ReactNode
    showForm: boolean
    onShowForm: () => void
    connections: any[]
    renderForm: React.ReactNode
    renderConnections: React.ReactNode
    emptyText: string
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
                        {icon}
                    </div>
                    <div>
                        <h2 className="font-semibold text-stone-900 dark:text-white">{title}</h2>
                        <p className="text-sm text-stone-500">{description}</p>
                    </div>
                </div>
                {!showForm && (
                    <Button onClick={onShowForm} variant="outline" className="h-9 px-3 text-sm">
                        <Plus className="w-4 h-4 mr-1.5" />
                        Add Site
                    </Button>
                )}
            </div>

            {showForm && renderForm}

            {connections.length > 0 ? (
                <div className="space-y-3">{renderConnections}</div>
            ) : !showForm ? (
                <div className="text-center py-8 bg-stone-50 dark:bg-stone-800/30 rounded-xl">
                    <p className="text-stone-600 dark:text-stone-400 mb-4">{emptyText}</p>
                    <Button onClick={onShowForm} variant="outline" className="h-9">
                        <Plus className="w-4 h-4 mr-1.5" />
                        Connect
                    </Button>
                </div>
            ) : null}
        </div>
    )
}

function ConnectionCard({
    name,
    subtitle,
    isDefault,
    iconBg,
    onSetDefault,
    onOpen,
    onDelete,
}: {
    name: string
    subtitle: string
    isDefault: boolean
    iconBg: string
    onSetDefault: () => void
    onOpen?: () => void
    onDelete: () => void
}) {
    return (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
                    <div className="w-4 h-4 bg-white/30 rounded" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900 dark:text-white">{name}</span>
                        {isDefault && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                Default
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-stone-500">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {!isDefault && (
                    <Button variant="ghost" size="sm" onClick={onSetDefault} className="h-8 text-xs">
                        Set Default
                    </Button>
                )}
                {onOpen && (
                    <Button variant="ghost" size="sm" onClick={onOpen} className="h-8 w-8 p-0">
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
