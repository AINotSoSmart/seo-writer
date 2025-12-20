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
import {
    getShopifyConnections,
    testShopifyConnection,
    addShopifyConnection,
    deleteShopifyConnection,
    setDefaultShopifyConnection
} from "@/actions/shopify"
import { toast } from "sonner"
import { Plus, Trash2, ExternalLink, Check, Loader2, Globe, Lock, User, Key, ChevronDown, Store } from "lucide-react"

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

interface ShopifyConnection {
    id: string
    store_name: string
    store_domain: string
    blog_id: string
    blog_title: string | null
    is_default: boolean
    created_at: string
}

interface ShopifyBlog {
    id: number
    title: string
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

    // Shopify state
    const [spConnections, setSpConnections] = useState<ShopifyConnection[]>([])
    const [showSpForm, setShowSpForm] = useState(false)
    const [spSubmitting, setSpSubmitting] = useState(false)
    const [spStoreDomain, setSpStoreDomain] = useState("")
    const [spNormalizedDomain, setSpNormalizedDomain] = useState("")
    const [spAccessToken, setSpAccessToken] = useState("")
    const [spShopName, setSpShopName] = useState("")
    const [spBlogs, setSpBlogs] = useState<ShopifyBlog[]>([])
    const [spStep, setSpStep] = useState<1 | 2>(1) // 1: credentials, 2: select blog

    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadConnections()
    }, [])

    const loadConnections = async () => {
        const [wpResult, wfResult, spResult] = await Promise.all([
            getWordPressConnections(),
            getWebflowConnections(),
            getShopifyConnections()
        ])

        if (!wpResult.error) setWpConnections(wpResult.connections)
        if (!wfResult.error) setWfConnections(wfResult.connections)
        if (!spResult.error) setSpConnections(spResult.connections)
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

    // Shopify handlers
    const handleSpTestConnection = async () => {
        if (!spStoreDomain || !spAccessToken) {
            toast.error("Please fill in all fields")
            return
        }

        setSpSubmitting(true)
        const result = await testShopifyConnection({
            storeDomain: spStoreDomain,
            accessToken: spAccessToken,
        })
        setSpSubmitting(false)

        if (result.success && result.blogs) {
            setSpShopName(result.shopName || spStoreDomain)
            setSpNormalizedDomain(result.normalizedDomain || spStoreDomain)
            if (result.blogs.length === 0) {
                toast.error("No blogs found in this store. Create a blog first.")
                return
            }
            setSpBlogs(result.blogs)
            setSpStep(2)
            toast.success("Connected!")
        } else {
            toast.error(result.error || "Failed to connect")
        }
    }

    const handleSpSelectBlog = async (blog: ShopifyBlog) => {
        setSpSubmitting(true)

        const result = await addShopifyConnection({
            storeDomain: spNormalizedDomain || spStoreDomain,
            accessToken: spAccessToken,
            storeName: spShopName,
            blogId: String(blog.id),
            blogTitle: blog.title,
        })
        setSpSubmitting(false)

        if (result.success) {
            toast.success("Shopify connected!")
            resetSpForm()
            loadConnections()
        } else {
            toast.error(result.error || "Failed to connect")
        }
    }

    const resetSpForm = () => {
        setShowSpForm(false)
        setSpStoreDomain("")
        setSpNormalizedDomain("")
        setSpAccessToken("")
        setSpShopName("")
        setSpBlogs([])
        setSpStep(1)
    }

    const handleSpDelete = async (id: string) => {
        const result = await deleteShopifyConnection(id)
        if (result.success) {
            toast.success("Connection removed")
            loadConnections()
        }
    }

    const handleSpSetDefault = async (id: string) => {
        const result = await setDefaultShopifyConnection(id)
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
                <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-stone-200/50  bg-stone-50/40  backdrop-blur-sm rounded-t-xl">
                    <h1 className="text-base md:text-lg font-bold text-stone-900 tracking-tight">
                        Integrations
                    </h1>
                </div>

                <div className="p-4 md:p-6 space-y-8">
                    {/* WordPress Section */}
                    <IntegrationSection
                        title="WordPress"
                        description="Publish articles directly to your WordPress site"
                        iconBg="#ffffffff"
                        icon={<img src="/brands/wordpress.svg" alt="WordPress" />}
                        showForm={showWpForm}
                        onShowForm={() => setShowWpForm(true)}
                        connections={wpConnections}
                        renderForm={
                            <form onSubmit={handleWpSubmit} className="mb-6 p-4 bg-stone-50 /50 rounded-xl border border-stone-200 ">
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
                                        <Button type="submit" disabled={wpSubmitting} className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white  ">
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
                        iconBg="#ffffffff"
                        icon={<img src="/brands/webflow.svg" alt="Webflow" />}
                        showForm={showWfForm}
                        onShowForm={() => setShowWfForm(true)}
                        connections={wfConnections}
                        renderForm={
                            <div className="mb-6 p-4 bg-stone-50 /50 rounded-xl border border-stone-200 ">
                                {/* Step indicator */}
                                <div className="flex items-center gap-2 mb-4 text-xs text-stone-500">
                                    <span className={wfStep >= 1 ? "text-stone-900  font-medium" : ""}>1. API Token</span>
                                    <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                                    <span className={wfStep >= 2 ? "text-stone-900  font-medium" : ""}>2. Select Site</span>
                                    <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                                    <span className={wfStep >= 3 ? "text-stone-900  font-medium" : ""}>3. Select Collection</span>
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
                                            <Button onClick={handleWfTestToken} disabled={wfSubmitting} className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white  ">
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
                                                className="w-full p-3 text-left rounded-lg border border-stone-200  hover:bg-stone-100 transition-colors"
                                            >
                                                <span className="font-medium text-stone-900 ">{site.displayName}</span>
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
                                                className="w-full p-3 text-left rounded-lg border border-stone-200  hover:bg-stone-100 transition-colors"
                                            >
                                                <span className="font-medium text-stone-900 ">{col.displayName}</span>
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

                    {/* Shopify Section */}
                    <IntegrationSection
                        title="Shopify"
                        description="Publish articles to your Shopify store blog"
                        iconBg="#96bf48"
                        icon={<Store className="w-5 h-5 text-white" />}
                        showForm={showSpForm}
                        onShowForm={() => setShowSpForm(true)}
                        connections={spConnections}
                        renderForm={
                            <div className="mb-6 p-4 bg-stone-50 /50 rounded-xl border border-stone-200 ">
                                {/* Step indicator */}
                                <div className="flex items-center gap-2 mb-4 text-xs text-stone-500">
                                    <span className={spStep >= 1 ? "text-stone-900  font-medium" : ""}>1. Store Credentials</span>
                                    <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                                    <span className={spStep >= 2 ? "text-stone-900  font-medium" : ""}>2. Select Blog</span>
                                </div>

                                {spStep === 1 && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="spStoreDomain" className="text-sm font-medium flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-stone-400" />
                                                Store Domain
                                            </Label>
                                            <Input
                                                id="spStoreDomain"
                                                type="text"
                                                placeholder="mystore or mystore.myshopify.com"
                                                value={spStoreDomain}
                                                onChange={(e) => setSpStoreDomain(e.target.value)}
                                                className="h-10"
                                            />
                                            <p className="text-xs text-stone-500">
                                                Just enter your store name (e.g., &quot;mystore&quot;)
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="spAccessToken" className="text-sm font-medium flex items-center gap-2">
                                                <Key className="w-4 h-4 text-stone-400" />
                                                Admin API Access Token
                                            </Label>
                                            <Input
                                                id="spAccessToken"
                                                type="password"
                                                placeholder="shpat_xxxxx..."
                                                value={spAccessToken}
                                                onChange={(e) => setSpAccessToken(e.target.value)}
                                                className="h-10"
                                            />
                                            <div className="text-xs text-stone-500 space-y-2">
                                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                    <p className="font-medium text-blue-800  mb-1">
                                                        Need the right token?
                                                    </p>
                                                    <p className="mb-2">Don&apos;t use the Partner Dashboard. Use the store admin directly:</p>
                                                    {spStoreDomain ? (
                                                        <a
                                                            href={`https://admin.shopify.com/store/${spStoreDomain.replace('.myshopify.com', '')}/settings/apps/development`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-blue-600  hover:underline font-medium"
                                                        >
                                                            Open Custom App Settings <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-stone-400">Enter store domain to see link</span>
                                                    )}
                                                </div>
                                                <p><strong>Steps:</strong></p>
                                                <ol className="list-decimal ml-4 space-y-0.5">
                                                    <li>Click the link above (or go to Settings → Apps → Develop apps)</li>
                                                    <li>Click &quot;Create an app&quot; (or "Allow custom app development")</li>
                                                    <li>Click &quot;Configure Admin API scopes&quot;</li>
                                                    <li>Check: <code className="bg-stone-200  px-1 rounded">read_content</code> and <code className="bg-stone-200  px-1 rounded">write_content</code></li>
                                                    <li>Install app → <strong>Reveal Admin API token</strong> (starts with <code>shpat_</code>)</li>
                                                </ol>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={handleSpTestConnection} disabled={spSubmitting} className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white  ">
                                                {spSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Verifying...</> : <>Continue</>}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={resetSpForm} className="h-9">Cancel</Button>
                                        </div>
                                    </div>
                                )}

                                {spStep === 2 && (
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">Select Blog</Label>
                                        <p className="text-xs text-stone-500 -mt-2">Choose where to publish articles</p>
                                        {spBlogs.map((blog) => (
                                            <button
                                                key={blog.id}
                                                onClick={() => handleSpSelectBlog(blog)}
                                                disabled={spSubmitting}
                                                className="w-full p-3 text-left rounded-lg border border-stone-200  hover:bg-stone-100 transition-colors"
                                            >
                                                <span className="font-medium text-stone-900 ">{blog.title}</span>
                                            </button>
                                        ))}
                                        <Button type="button" variant="ghost" onClick={resetSpForm} className="h-9 mt-2">Cancel</Button>
                                    </div>
                                )}
                            </div>
                        }
                        renderConnections={spConnections.map((conn) => (
                            <ConnectionCard
                                key={conn.id}
                                name={conn.store_name}
                                subtitle={`Blog: ${conn.blog_title || conn.blog_id}`}
                                isDefault={conn.is_default}
                                iconBg="#96bf48"
                                onSetDefault={() => handleSpSetDefault(conn.id)}
                                onOpen={() => window.open(`https://${conn.store_domain}/admin`, '_blank')}
                                onDelete={() => handleSpDelete(conn.id)}
                            />
                        ))}
                        emptyText="No Shopify stores connected yet"
                    />

                    {/* More integrations */}
                    <div className="border-t border-stone-200  pt-6">
                        <p className="text-sm text-stone-500 text-center">
                            More integrations coming soon (Ghost, Medium...)
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
                        <h2 className="font-semibold text-stone-900 ">{title}</h2>
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
                <div className="text-center py-8 bg-stone-50 /30 rounded-xl">
                    <p className="text-stone-600 mb-4">{emptyText}</p>
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
        <div className="flex items-center justify-between p-4 bg-white /50 rounded-xl border border-stone-200 ">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
                    <div className="w-4 h-4 bg-white/30 rounded" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900 ">{name}</span>
                        {isDefault && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700  rounded-full">
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
                <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
