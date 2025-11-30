import { tavily } from "@tavily/core"

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export async function scrapeStyleUrl(url: string): Promise<string> {
  const res = await tvly.search(url, {
    search_depth: "advanced",
    include_text: true,
    max_results: 1,
  })
  const first = res.results?.[0]
  if (!first || !first.content) throw new Error("Failed to scrape URL via Tavily")
  return first.content
}