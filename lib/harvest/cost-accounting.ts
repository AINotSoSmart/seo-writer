type CostRate = {
    inputPerMillion?: number
    outputPerMillion?: number
    perRequest?: number
}

type CostEvent = {
    provider: string
    model: string
    operation: string
    requestCount: number
    inputUnits: number
    outputUnits: number
    usageComplete: boolean
}

function configuredRates(): Record<string, CostRate> {
    try {
        return JSON.parse(process.env.PROGRAM_COST_RATES_JSON || "{}")
    } catch {
        return {}
    }
}

function usageFromGemini(response: any): {
    inputUnits: number
    outputUnits: number
} {
    const usage = response?.usageMetadata || response?.usage_metadata || {}
    return {
        inputUnits: Number(
            usage.promptTokenCount ?? usage.prompt_token_count ?? 0,
        ),
        outputUnits: Number(
            usage.candidatesTokenCount ?? usage.candidates_token_count ?? 0,
        ),
    }
}

export class ProgramCostCollector {
    private readonly events: CostEvent[] = []

    record(event: CostEvent): CostEvent {
        this.events.push(event)
        return event
    }

    recordRequest(
        provider: string,
        model: string,
        operation: string,
    ): void {
        this.record({
            provider,
            model,
            operation,
            requestCount: 1,
            inputUnits: 0,
            outputUnits: 0,
            usageComplete: true,
        })
    }

    async persist(
        supabase: any,
        plannedArticleId: string | undefined,
        articleId: string,
    ): Promise<void> {
        if (!plannedArticleId || this.events.length === 0) return

        const { data: planned } = await supabase
            .from("planned_articles")
            .select("cluster_id")
            .eq("id", plannedArticleId)
            .maybeSingle()
        if (!planned?.cluster_id) return

        const { data: programCluster } = await supabase
            .from("program_clusters")
            .select("id, program_id")
            .eq("audit_cluster_id", planned.cluster_id)
            .maybeSingle()
        if (!programCluster) return

        const rates = configuredRates()
        const rows = this.events.map((event) => {
            const rate =
                rates[`${event.provider}:${event.model}`] ||
                rates[event.model] ||
                rates[event.provider]
            const cost =
                rate &&
                event.usageComplete &&
                ((event.inputUnits / 1_000_000) *
                    Number(rate.inputPerMillion || 0) +
                    (event.outputUnits / 1_000_000) *
                        Number(rate.outputPerMillion || 0) +
                    event.requestCount * Number(rate.perRequest || 0))
            return {
                program_id: programCluster.program_id,
                program_cluster_id: programCluster.id,
                planned_article_id: plannedArticleId,
                article_id: articleId,
                provider: event.provider,
                model: event.model,
                operation: event.operation,
                request_count: event.requestCount,
                input_units: event.inputUnits,
                output_units: event.outputUnits,
                usage_complete: event.usageComplete,
                cost_usd:
                    typeof cost === "number" && Number.isFinite(cost)
                        ? cost
                        : null,
                pricing_source: !event.usageComplete
                    ? "usage_unavailable"
                    : rate
                      ? "PROGRAM_COST_RATES_JSON"
                      : "unconfigured",
            }
        })
        const { error } = await supabase.from("program_cost_events").insert(rows)
        if (error) {
            throw new Error(`Program cost persistence failed: ${error.message}`)
        }
    }
}

export function trackGeminiClient<T>(
    client: T,
    collector: ProgramCostCollector,
): T {
    const rawClient = client as any
    const models = new Proxy(rawClient.models, {
        get(target, property, receiver) {
            if (property === "generateContent") {
                return async (request: any) => {
                    const event = collector.record({
                        provider: "gemini",
                        model: String(request?.model || "unknown"),
                        operation: "generate_content",
                        requestCount: 1,
                        inputUnits: 0,
                        outputUnits: 0,
                        usageComplete: false,
                    })
                    const response = await target.generateContent(request)
                    Object.assign(event, usageFromGemini(response), {
                        usageComplete: true,
                    })
                    return response
                }
            }
            if (property === "generateContentStream") {
                return async (request: any) => {
                    const event = collector.record({
                        provider: "gemini",
                        model: String(request?.model || "unknown"),
                        operation: "generate_content_stream",
                        requestCount: 1,
                        inputUnits: 0,
                        outputUnits: 0,
                        usageComplete: false,
                    })
                    const stream = await target.generateContentStream(request)
                    return {
                        async *[Symbol.asyncIterator]() {
                            let finalUsage = { inputUnits: 0, outputUnits: 0 }
                            for await (const chunk of stream) {
                                const usage = usageFromGemini(chunk)
                                if (usage.inputUnits || usage.outputUnits) {
                                    finalUsage = usage
                                }
                                yield chunk
                            }
                            Object.assign(event, {
                                ...finalUsage,
                                usageComplete: true,
                            })
                        },
                    }
                }
            }
            return Reflect.get(target, property, receiver)
        },
    })

    return new Proxy(rawClient, {
        get(target, property, receiver) {
            if (property === "models") return models
            return Reflect.get(target, property, receiver)
        },
    }) as T
}

export function trackTavilyClient<T>(
    client: T,
    collector: ProgramCostCollector,
): T {
    return new Proxy(client as any, {
        get(target, property, receiver) {
            if (property === "search") {
                return async (...args: any[]) => {
                    collector.recordRequest(
                        "tavily",
                        "search",
                        "deep_research_search",
                    )
                    return target.search(...args)
                }
            }
            return Reflect.get(target, property, receiver)
        },
    }) as T
}
