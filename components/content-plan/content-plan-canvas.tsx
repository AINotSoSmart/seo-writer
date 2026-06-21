"use client"

import { useCallback, useMemo, useState } from "react"
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    BackgroundVariant,
    Panel,
    type Node,
    type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./canvas-styles.css"

import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { PillarRecommendation } from "@/components/content-plan/pillar-pages-section"
import { nodeTypes } from "./canvas-nodes"
import { buildCanvasGraph } from "./canvas-layout"

interface ContentPlanCanvasProps {
    planData: ContentPlanItem[]
    pillars: PillarRecommendation[] | null
    brandWebsiteUrl: string | null
    discoveredCompetitors: any[] | null
}

export function ContentPlanCanvas({
    planData,
    pillars,
    brandWebsiteUrl,
    discoveredCompetitors,
}: ContentPlanCanvasProps) {
    // Derive brand name from website URL
    const brandName = useMemo(() => {
        if (!brandWebsiteUrl) return "Content Strategy"
        try {
            const url = new URL(brandWebsiteUrl)
            // Extract domain name and capitalize
            const domain = url.hostname.replace(/^www\./, "")
            const name = domain.split(".")[0]
            return name.charAt(0).toUpperCase() + name.slice(1)
        } catch {
            return brandWebsiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
        }
    }, [brandWebsiteUrl])

    // Build graph from data
    const { initialNodes, initialEdges } = useMemo(() => {
        const { nodes, edges } = buildCanvasGraph({
            planData,
            pillars,
            brandName,
        })
        return { initialNodes: nodes, initialEdges: edges }
    }, [planData, pillars, brandName])

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

    // Interactive Hover State
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

    // Legend visibility
    const [showLegend, setShowLegend] = useState(true)

    // Stats
    const stats = useMemo(() => {
        const total = planData.length
        const published = planData.filter(i => i.status === "published").length
        const writing = planData.filter(i => i.status === "writing").length
        const pending = planData.filter(i => i.status === "pending").length
        const clusters = [...new Set(planData.map(i => i.cluster).filter(Boolean))]
        const categories = [...new Set(planData.map(i => i.article_category).filter(Boolean))]
        return { total, published, writing, pending, clusters, categories }
    }, [planData])

    // Compute interactive nodes styling (Focus Mode)
    const styledNodes = useMemo(() => {
        if (!hoveredNodeId) return nodes

        const connectedNodeIds = new Set<string>([hoveredNodeId])
        edges.forEach(edge => {
            const isConnectionEdge = edge.className === "connected-edge" || edge.id.startsWith("connection-")
            if (isConnectionEdge) {
                if (edge.source === hoveredNodeId) connectedNodeIds.add(edge.target)
                if (edge.target === hoveredNodeId) connectedNodeIds.add(edge.source)
            }
        })

        return nodes.map(node => {
            const isConnected = connectedNodeIds.has(node.id)
            const isStructureNode = node.type === "brandNode" || node.type === "pillarNode" || node.type === "categoryNode"
            
            return {
                ...node,
                style: {
                    ...node.style,
                    opacity: isConnected || isStructureNode ? 1 : 0.3,
                    transition: "opacity 0.2s ease",
                }
            }
        })
    }, [nodes, edges, hoveredNodeId])

    // Compute interactive edges styling (Focus Mode)
    const styledEdges = useMemo(() => {
        return edges.map(edge => {
            const isConnectionEdge = edge.className === "connected-edge" || edge.id.startsWith("connection-")
            
            if (!isConnectionEdge) {
                // Fade structural edges if focusing on an article
                return {
                    ...edge,
                    style: {
                        ...edge.style,
                        opacity: hoveredNodeId ? 0.25 : 1,
                        transition: "opacity 0.2s ease",
                    }
                }
            }
            
            // Show relationship lines ONLY if they touch the hovered article
            const isRelated = edge.source === hoveredNodeId || edge.target === hoveredNodeId
            return {
                ...edge,
                hidden: !isRelated,
                style: {
                    ...edge.style,
                    opacity: isRelated ? 1 : 0,
                    transition: "opacity 0.2s ease",
                }
            }
        })
    }, [edges, hoveredNodeId])

    return (
        <div className="content-plan-canvas" style={{ height: "calc(100vh - 160px)", minHeight: "600px" }}>
            <ReactFlow
                nodes={styledNodes}
                edges={styledEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeMouseEnter={(_, node) => {
                    if (node.type === "articleNode") {
                        setHoveredNodeId(node.id)
                    }
                }}
                onNodeMouseLeave={() => {
                    setHoveredNodeId(null)
                }}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                minZoom={0.1}
                maxZoom={2}
                defaultEdgeOptions={{
                    type: "smoothstep",
                    animated: false,
                    style: { stroke: "#a8a29e", strokeWidth: 1.5 },
                }}
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    color="#e7e5e4"
                />
                <Controls
                    showInteractive={false}
                    position="bottom-right"
                />
                <MiniMap
                    position="top-right"
                    pannable
                    zoomable
                    nodeStrokeWidth={2}
                    nodeBorderRadius={8}
                    maskColor="rgba(120, 113, 108, 0.05)"
                    style={{ width: 160, height: 100 }}
                />

                {/* Legend Panel */}
                {showLegend && (
                    <Panel position="bottom-left">
                        <div className="canvas-legend">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    Legend
                                </span>
                                <button
                                    onClick={() => setShowLegend(false)}
                                    style={{ fontSize: 10, color: "#a8a29e", cursor: "pointer", background: "none", border: "none" }}
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ fontSize: 9, color: "#78716c", fontStyle: "italic", marginBottom: 8 }}>
                                💡 Hover over a card to view connections.
                            </div>
                            <div className="canvas-legend__item">
                                <div className="canvas-legend__dot" style={{ background: "#10b981" }} />
                                Published
                            </div>
                            <div className="canvas-legend__item">
                                <div className="canvas-legend__dot" style={{ background: "#3b82f6" }} />
                                Writing
                            </div>
                            <div className="canvas-legend__item">
                                <div className="canvas-legend__dot" style={{ background: "transparent", border: "1.5px solid #a8a29e" }} />
                                Planned
                            </div>
                            <div style={{ height: 1, background: "#e7e5e4", margin: "6px 0" }} />
                            <div className="canvas-legend__item">
                                <div style={{ width: 16, height: 2, background: "#a8a29e", borderRadius: 1 }} />
                                Hierarchy
                            </div>
                            <div className="canvas-legend__item">
                                <div style={{ width: 16, height: 2, background: "#6366f1", borderRadius: 1, backgroundImage: "repeating-linear-gradient(90deg, #6366f1 0px, #6366f1 4px, transparent 4px, transparent 7px)" }} />
                                Connected Articles
                            </div>
                            <div style={{ height: 1, background: "#e7e5e4", margin: "6px 0" }} />
                            <div className="canvas-legend__item" style={{ gap: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: 2, background: "#d97706" }} />
                                Core
                                <div style={{ width: 6, height: 6, borderRadius: 2, background: "#2563eb" }} />
                                Support
                                <div style={{ width: 6, height: 6, borderRadius: 2, background: "#059669" }} />
                                Convert
                                <div style={{ width: 6, height: 6, borderRadius: 2, background: "#7c3aed" }} />
                                Authority
                            </div>
                        </div>
                    </Panel>
                )}

                {/* Stats Panel */}
                <Panel position="top-left">
                    <div style={{
                        background: "rgba(255, 255, 255, 0.85)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid #e7e5e4",
                        borderRadius: 12,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)"
                    }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#1c1917" }}>{stats.total}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>Articles</div>
                        </div>
                        <div style={{ width: 1, height: 28, background: "#e7e5e4" }} />
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>{stats.published}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>Live</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6" }}>{stats.writing}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>Writing</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#78716c" }}>{stats.pending}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>Planned</div>
                        </div>
                        {stats.clusters.length > 0 && (
                            <>
                                <div style={{ width: 1, height: 28, background: "#e7e5e4" }} />
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: "#7c3aed" }}>{stats.clusters.length}</div>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>Clusters</div>
                                </div>
                            </>
                        )}
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    )
}
