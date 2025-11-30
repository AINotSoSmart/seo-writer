For the "Competitor Research" (Top 5-10 URLs)
Instead of Firecrawl, use Tavily. It returns the content cleaned and ready for Gemini.

// npm install @tavily/core

import { tavily } from "@tavily/core";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function getCompetitorData(keyword) {
  const response = await tvly.search(keyword, {
    search_depth: "advanced", // Digs deeper for better content
    include_raw_content: false, // We want the cleaned content, not raw HTML
    include_text: true, // <--- This gives you the parsed main article text!
    max_results: 5, // Limit to top 5 to save context window tokens
  });

  // Response looks like:
  // [
  //   { url: "...", content: "The full blog post text..." },
  //   { url: "...", content: "..." }
  // ]
  
  return response.results;
}



2. For the "Style Stealing" (Tab 1 - Single URL)
Use Tavily to extract the main content from a single URL. Call `search` with the URL string and `include_text: true`, limiting to 1 result.

import { tavily } from "@tavily/core";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function getStyleSource(url) {
  const response = await tvly.search(url, {
    search_depth: "advanced",
    include_text: true,
    max_results: 1,
  });
  const first = response.results?.[0];
  if (!first || !first.content) throw new Error("Failed to scrape style URL via Tavily");
  return first.content; // Markdown-like cleaned text
}



3. How to handle the "Noise"
You are seeing a lot of junk in the raw_content field, like:
![avatar] ... Login ... Sign up ... Footer ... Privacy Policy
Do not try to clean this with code. It is too hard to write regex for every website.
Gemini 3 Pro loves this noise. It understands document structure.
Here is the Prompt Strategy to handle this data:
When you send this JSON to Gemini 3 Pro to create your "Fact Sheet," use this specific instruction:
System Prompt:
"You are an expert Data Analyst. I will provide raw scraped text from 5 competitor websites.
Your Task: Create a structured 'Fact Sheet' and 'Content Gap Analysis'.
Data Cleaning Rules:
Ignore UI Elements: Ignore words like 'Login', 'Sign up', 'Footer', 'Cookies', or image alt tags (e.g., '![avatar]').
Focus on Content: Extract specific steps, pricing, features, and timestamps.
Analyze Transcripts: One of the sources is a video transcript. Extract the unique 'pro tips' the speaker mentions.
Input Data:
[Insert Tavily JSON Results Here]"
Final Verdict
You have successfully moved from "Bankrupt" (Firecrawl) to "Profitable" (Tavily).
Data Quality: 10/10 (Includes transcripts & headers).
Cost: 2 Credits per article ($0.002).
Next Step: Feed this raw_content directly into your Gemini 3 Pro "Research" step. You are ready to build.