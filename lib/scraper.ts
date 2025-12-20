import { tavily } from "@tavily/core"

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export async function scrapeStyleUrl(url: string): Promise<string> {
  const res = await tvly.search(url, {
    searchDepth: "advanced",
    includeRawContent: "markdown",
    maxResults: 1,
  })
  const first = res.results?.[0]
  if (!first || (!first.rawContent && !first.content)) throw new Error("Failed to scrape URL via Tavily")
  return first.rawContent || first.content || ""
}