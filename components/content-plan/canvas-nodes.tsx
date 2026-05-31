"use client"

import { memo, useState } from "react"
import { Handle, Position } from "@xyflow/react"
import {
    Calendar,
    Sparkles,
    Zap,
    Target,
    FileText,
    BookOpen,
    BarChart3,
    CheckCircle2,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    MousePointerClick,
    PenTool,
    ArrowUp,
    ArrowRight,
    ArrowDown,
    Layers,
    Tag,
    Search,
    ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Brand Node ─────────────────────────────────────────

function BrandNodeComponent({ data }: { data: any }) {
    return (
        <div className="canvas-brand-node">
            <Handle type="source" position={Position.Bottom} id="bottom" />
            <div className="canvas-brand-node__title">{data.label}</div>
            <div className="canvas-brand-node__badge">
                <Layers style={{ width: 10, height: 10 }} />
                {data.totalArticles} articles · {data.publishedCount} live
            </div>
        </div>
    )
}

// ─── Pillar Node ─────────────────────────────────────────

function PillarNodeComponent({ data }: { data: any }) {
    return (
        <div className="canvas-pillar-node">
            <Handle type="target" position={Position.Top} id="top" />
            <Handle type="source" position={Position.Bottom} id="bottom" />
            <div className="canvas-pillar-node__title">{data.label}</div>
            {data.description && (
                <div className="canvas-pillar-node__desc">{data.description}</div>
            )}
            {data.slug && (
                <div className="canvas-pillar-node__slug">/{data.slug}</div>
            )}
            {data.created && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 10, fontWeight: 600, color: "#10b981" }}>
                    <CheckCircle2 style={{ width: 11, height: 11 }} />
                    Created
                </div>
            )}
        </div>
    )
}

// ─── Category Node ─────────────────────────────────────────

function CategoryNodeComponent({ data }: { data: any }) {
    return (
        <div
            className="canvas-category-node"
            data-category={data.category}
        >
            <Handle type="target" position={Position.Top} id="top" />
            <Handle type="source" position={Position.Bottom} id="bottom" />
            <div className="canvas-category-node__header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: 3,
                        background: data.color || "#78716c",
                        flexShrink: 0,
                    }} />
                    <div className="canvas-category-node__title">{data.label}</div>
                </div>
                <div className="canvas-category-node__count">
                    {data.publishedCount}/{data.articleCount}
                </div>
            </div>
            <div className="canvas-category-node__tagline">{data.tagline}</div>
        </div>
    )
}

// ─── Article Node (richest) ─────────────────────────────────

const ARTICLE_TYPE_ICONS: Record<string, { icon: any; label: string }> = {
    informational: { icon: FileText, label: "Info" },
    commercial: { icon: BarChart3, label: "Commercial" },
    howto: { icon: BookOpen, label: "How-To" },
}

const BADGE_MAP: Record<string, { icon: any; label: string }> = {
    high_impact: { icon: Sparkles, label: "High Impact" },
    quick_win: { icon: Zap, label: "Quick Win" },
    low_ctr: { icon: MousePointerClick, label: "Low CTR" },
    new_opportunity: { icon: Target, label: "New Oppo." },
}

const IMPACT_ICONS: Record<string, { icon: any; color: string }> = {
    High: { icon: ArrowUp, color: "#16a34a" },
    Medium: { icon: ArrowRight, color: "#d97706" },
    Low: { icon: ArrowDown, color: "#a8a29e" },
}

function ArticleNodeComponent({ data }: { data: any }) {
    const [expanded, setExpanded] = useState(false)

    const typeConfig = ARTICLE_TYPE_ICONS[data.article_type || "informational"] || ARTICLE_TYPE_ICONS.informational
    const TypeIcon = typeConfig.icon
    const badgeConfig = data.badge ? BADGE_MAP[data.badge] : null
    const BadgeIcon = badgeConfig?.icon
    const impactConfig = data.impact ? IMPACT_ICONS[data.impact] : null
    const ImpactIcon = impactConfig?.icon

    const hasGscData = (data.gsc_impressions ?? 0) > 0 || (data.gsc_position ?? 0) > 0
    const hasExpandableContent = data.reason || data.user_instructions || (data.supporting_keywords?.length > 3)

    return (
        <div
            className={cn(
                "canvas-article-node",
                data.status === "published" && "canvas-article-node--published",
                data.status === "writing" && "canvas-article-node--writing"
            )}
            onClick={() => hasExpandableContent && setExpanded(!expanded)}
        >
            <Handle type="target" position={Position.Top} id="top" />
            <Handle type="source" position={Position.Left} id="left" />
            <Handle type="source" position={Position.Right} id="right" />

            {/* Header: Status + Phase + Impact */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {/* Status dot */}
                <div className={cn(
                    "canvas-article-node__status",
                    data.status === "published" && "canvas-article-node__status--published",
                    data.status === "writing" && "canvas-article-node__status--writing",
                    data.status === "pending" && "canvas-article-node__status--pending"
                )} />

                {/* Phase */}
                {data.phase && (
                    <span className={cn(
                        "canvas-article-node__phase",
                        `canvas-article-node__phase--${data.phase}`
                    )}>
                        {data.phase}
                    </span>
                )}

                {/* Impact */}
                {impactConfig && ImpactIcon && (
                    <span className={cn("canvas-article-node__impact", `canvas-article-node__impact--${data.impact}`)}>
                        <ImpactIcon style={{ width: 10, height: 10 }} />
                        {data.impact}
                    </span>
                )}

                {/* Article Type */}
                <span className="canvas-article-node__type">
                    <TypeIcon style={{ width: 10, height: 10 }} />
                    {typeConfig.label}
                </span>
            </div>

            {/* Title */}
            <div className="canvas-article-node__title">{data.title}</div>

            {/* Hook */}
            {data.hook && (
                <div className="canvas-article-node__hook" style={{ marginTop: 4 }}>{data.hook}</div>
            )}

            {/* Keyword + Intent + Cluster */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 8 }}>
                <span className="canvas-article-node__keyword">
                    <Search style={{ width: 9, height: 9, flexShrink: 0 }} />
                    {data.main_keyword}
                </span>
                {data.user_intent && (
                    <span className="canvas-article-node__intent">{data.user_intent}</span>
                )}
                {data.cluster && (
                    <span className="canvas-article-node__cluster">
                        <Tag style={{ width: 9, height: 9 }} />
                        {data.cluster}
                    </span>
                )}
            </div>

            {/* GSC Metrics */}
            {hasGscData && (
                <div className="canvas-article-node__metrics" style={{ marginTop: 6 }}>
                    {(data.gsc_impressions ?? 0) > 0 && (
                        <span className="canvas-article-node__metric">
                            <TrendingUp className="canvas-article-node__metric-icon" />
                            {data.gsc_impressions > 1000 ? `${(data.gsc_impressions / 1000).toFixed(1)}k` : data.gsc_impressions} imp
                        </span>
                    )}
                    {(data.gsc_position ?? 0) > 0 && (
                        <span className="canvas-article-node__metric">
                            <Target className="canvas-article-node__metric-icon" />
                            #{data.gsc_position?.toFixed(1)}
                        </span>
                    )}
                    {(data.opportunity_score ?? 0) > 0 && (
                        <span className="canvas-article-node__opp-score">
                            <Sparkles style={{ width: 9, height: 9 }} />
                            {data.opportunity_score}
                        </span>
                    )}
                </div>
            )}

            {/* Supporting Keywords */}
            {data.supporting_keywords && data.supporting_keywords.length > 0 && (
                <div className="canvas-article-node__supporting" style={{ marginTop: 6 }}>
                    {data.supporting_keywords.slice(0, expanded ? undefined : 3).map((kw: string, i: number) => (
                        <span key={i} className="canvas-article-node__supporting-kw">{kw}</span>
                    ))}
                    {!expanded && data.supporting_keywords.length > 3 && (
                        <span className="canvas-article-node__supporting-kw" style={{ color: "#a8a29e" }}>
                            +{data.supporting_keywords.length - 3}
                        </span>
                    )}
                </div>
            )}

            {/* Footer: Date + Badge */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid rgba(0,0,0,0.05)",
            }}>
                <span className="canvas-article-node__date">
                    <Calendar style={{ width: 10, height: 10 }} />
                    {(() => {
                        try {
                            return new Date(data.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        } catch {
                            return data.scheduled_date
                        }
                    })()}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {badgeConfig && BadgeIcon && (
                        <span className="canvas-article-node__badge">
                            <BadgeIcon style={{ width: 9, height: 9 }} />
                            {badgeConfig.label}
                        </span>
                    )}
                    {hasExpandableContent && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 2,
                                color: "#a8a29e",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            {expanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="canvas-article-node__expanded">
                    {data.reason && (
                        <div className="canvas-article-node__reason">
                            <span style={{ fontWeight: 700, color: "#44403c", marginRight: 4, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Why:</span>
                            {data.reason}
                        </div>
                    )}
                    {data.user_instructions && (
                        <div className="canvas-article-node__instructions">
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                <PenTool style={{ width: 10, height: 10 }} />
                                Editorial Brief
                            </div>
                            {data.user_instructions}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Exports ─────────────────────────────────────────

export const BrandNode = memo(BrandNodeComponent)
export const PillarNode = memo(PillarNodeComponent)
export const CategoryNode = memo(CategoryNodeComponent)
export const ArticleNode = memo(ArticleNodeComponent)

export const nodeTypes = {
    brandNode: BrandNode,
    pillarNode: PillarNode,
    categoryNode: CategoryNode,
    articleNode: ArticleNode,
}
