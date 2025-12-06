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
import { toast } from "sonner"
import { Plus, Trash2, ExternalLink, Check, Loader2, Globe, Lock, User } from "lucide-react"
import Link from "next/link"

interface WordPressConnection {
    id: string
    site_url: string
    site_name: string | null
    username: string
    is_default: boolean
    created_at: string
}

export default function IntegrationsPage() {
    const [connections, setConnections] = useState<WordPressConnection[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Form state
    const [siteUrl, setSiteUrl] = useState("")
    const [username, setUsername] = useState("")
    const [appPassword, setAppPassword] = useState("")

    useEffect(() => {
        loadConnections()
    }, [])

    const loadConnections = async () => {
        const result = await getWordPressConnections()
        if (result.error) {
            toast.error(result.error)
        } else {
            setConnections(result.connections)
        }
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!siteUrl || !username || !appPassword) {
            toast.error("Please fill in all fields")
            return
        }

        setSubmitting(true)
        const result = await addWordPressConnection({ siteUrl, username, appPassword })
        setSubmitting(false)

        if (result.success) {
            toast.success(`Connected to ${result.siteName || siteUrl}`)
            setSiteUrl("")
            setUsername("")
            setAppPassword("")
            setShowForm(false)
            loadConnections()
        } else {
            toast.error(result.error || "Failed to connect")
        }
    }

    const handleDelete = async (id: string) => {
        const result = await deleteWordPressConnection(id)
        if (result.success) {
            toast.success("Connection removed")
            loadConnections()
        } else {
            toast.error(result.error || "Failed to remove")
        }
    }

    const handleSetDefault = async (id: string) => {
        const result = await setDefaultConnection(id)
        if (result.success) {
            toast.success("Default connection updated")
            loadConnections()
        } else {
            toast.error(result.error || "Failed to update")
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
                    <div className="flex items-center gap-3">
                        <h1 className="text-base md:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                            Integrations
                        </h1>
                    </div>
                </div>

                <div className="p-4 md:p-6">
                    {/* WordPress Section */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#21759b] rounded-lg flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                                        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.5 16.5l-3-9h1.5l2 6 2-6H14l-3 9h-0.5zm6.5-9c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5 1.5-.672 1.5-1.5-.672-1.5-1.5-1.5z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="font-semibold text-stone-900 dark:text-white">WordPress</h2>
                                    <p className="text-sm text-stone-500">Publish articles directly to your WordPress site</p>
                                </div>
                            </div>

                            {!showForm && (
                                <Button
                                    onClick={() => setShowForm(true)}
                                    variant="outline"
                                    className="h-9 px-3 text-sm"
                                >
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Add Site
                                </Button>
                            )}
                        </div>

                        {/* Connection Form */}
                        {showForm && (
                            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="siteUrl" className="text-sm font-medium flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-stone-400" />
                                            WordPress Site URL
                                        </Label>
                                        <Input
                                            id="siteUrl"
                                            type="url"
                                            placeholder="https://yoursite.com"
                                            value={siteUrl}
                                            onChange={(e) => setSiteUrl(e.target.value)}
                                            className="h-10"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="username" className="text-sm font-medium flex items-center gap-2">
                                            <User className="w-4 h-4 text-stone-400" />
                                            WordPress Username
                                        </Label>
                                        <Input
                                            id="username"
                                            type="text"
                                            placeholder="admin"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="h-10"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="appPassword" className="text-sm font-medium flex items-center gap-2">
                                            <Lock className="w-4 h-4 text-stone-400" />
                                            Application Password
                                        </Label>
                                        <Input
                                            id="appPassword"
                                            type="password"
                                            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                                            value={appPassword}
                                            onChange={(e) => setAppPassword(e.target.value)}
                                            className="h-10"
                                            required
                                        />
                                        <p className="text-xs text-stone-500">
                                            Generate in WordPress → Users → Profile → Application Passwords
                                        </p>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            type="submit"
                                            disabled={submitting}
                                            className="h-9 px-4 bg-stone-900 hover:bg-stone-800 text-white dark:bg-white dark:text-stone-900"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                                    Testing...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-4 h-4 mr-1.5" />
                                                    Test & Connect
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setShowForm(false)}
                                            className="h-9"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Connected Sites */}
                        {connections.length > 0 ? (
                            <div className="space-y-3">
                                {connections.map((conn) => (
                                    <div
                                        key={conn.id}
                                        className="flex items-center justify-between p-4 bg-white dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#21759b] rounded-lg flex items-center justify-center">
                                                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                                                    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-stone-900 dark:text-white">
                                                        {conn.site_name || conn.site_url}
                                                    </span>
                                                    {conn.is_default && (
                                                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-stone-500">{conn.site_url}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!conn.is_default && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSetDefault(conn.id)}
                                                    className="h-8 text-xs"
                                                >
                                                    Set Default
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(conn.site_url, '_blank')}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(conn.id)}
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : !showForm ? (
                            <div className="text-center py-12 bg-stone-50 dark:bg-stone-800/30 rounded-xl">
                                <div className="w-12 h-12 bg-stone-200 dark:bg-stone-700 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Globe className="w-6 h-6 text-stone-400" />
                                </div>
                                <p className="text-stone-600 dark:text-stone-400 mb-4">
                                    No WordPress sites connected yet
                                </p>
                                <Button
                                    onClick={() => setShowForm(true)}
                                    variant="outline"
                                    className="h-9"
                                >
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Connect WordPress Site
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {/* More integrations placeholder */}
                    <div className="border-t border-stone-200 dark:border-stone-800 pt-6">
                        <p className="text-sm text-stone-500 text-center">
                            More integrations coming soon (Webflow, Ghost, Medium...)
                        </p>
                    </div>
                </div>
            </GlobalCard>
        </div>
    )
}
