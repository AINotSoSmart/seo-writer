'use server';

import { createClient } from "@/utils/supabase/server";
import { getGscSites, getCachedGscData } from "@/lib/gsc";
import { computeExpertSeoDirectives } from "@/lib/seo-insights";
import { GoogleGenAI, Type } from '@google/genai';
import * as cheerio from 'cheerio';
import { revalidatePath } from 'next/cache';

export async function getUserGscToken() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("gsc_connections")
    .select("access_token, site_url")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new Error("No GSC connection found");
  }

  return { token: data.access_token, defaultSite: data.site_url, userId: user.id };
}

export async function getDashboardDirectives(siteUrl: string, days: number = 30) {
  const { userId } = await getUserGscToken();
  const { currentData, previousData } = await getCachedGscData(userId, siteUrl, days);
  return computeExpertSeoDirectives(currentData, previousData);
}

export async function fetchLivePageData(url: string) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SEO-Agent/1.0' } });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    return {
      title: $('title').text() || '',
      metaDescription: $('meta[name="description"]').attr('content') || '',
      h1: $('h1').first().text() || ''
    };
  } catch (e) {
    console.error("Failed to fetch live page", e);
    return null;
  }
}

async function getBrandDetails(userId: string, siteUrl: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brand_details')
    .select('brand_data')
    .eq('user_id', userId)
    .eq('website_url', siteUrl)
    .single();

  if (error || !data) return null;
  return data.brand_data;
}

export async function generateActionableFix(type: 'ctr' | 'striking' | 'cannibalization' | 'emerging' | 'decay' | 'aeo', item: any, siteUrl: string, fullContext?: any) {
  const { userId } = await getUserGscToken();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in secrets.');
  const ai = new GoogleGenAI({ apiKey });

  const rawBrandDna = await getBrandDetails(userId, siteUrl);
  // Strip out writing tone/voice to save tokens, we only need strategic positioning for SEO architecture
  const strategicPositioning = rawBrandDna ? {
    audience: rawBrandDna.audience,
    core_features: rawBrandDna.core_features,
    uvp: rawBrandDna.uvp,
    mission: rawBrandDna.mission,
    product_identity: rawBrandDna.product_identity
  } : null;

  let crossSignalAlert = '';
  if (fullContext) {
    const targetUrl = type === 'cannibalization' ? item.pages?.[0]?.url : item.page;
    if (targetUrl) {
      const conflicts: string[] = [];
      const ctrMatch = fullContext.ctrInterventions?.find((x: any) => x.page === targetUrl);
      if (ctrMatch && type !== 'ctr') conflicts.push(`CTR Decay (Primary Query: "${ctrMatch.primaryQuery}")`);
      const strikingMatch = fullContext.strikingDistance?.find((x: any) => x.page === targetUrl);
      if (strikingMatch && type !== 'striking') conflicts.push(`Striking Distance optimization needed for "${strikingMatch.query}"`);
      const decayMatch = fullContext.contentDecay?.find((x: any) => x.page === targetUrl);
      if (decayMatch && type !== 'decay') conflicts.push(`Severe Content Decay detected for "${decayMatch.query}"`);
      const cannibMatch = fullContext.cannibalization?.find((x: any) => x.pages?.some((p: any) => p.url === targetUrl));
      if (cannibMatch && type !== 'cannibalization') conflicts.push(`Keyword Cannibalization conflict with "${cannibMatch.query}"`);

      if (conflicts.length > 0) {
        crossSignalAlert = `
      HOLISTIC STRATEGY ALERT:
      While formulating your strategy for this specific issue, be highly aware that this exact URL (${targetUrl}) is ALSO suffering from the following SEO crises simultaneously:
      ${conflicts.map((c: string) => `- ${c}`).join('\n')}
      You MUST ensure your recommendation does not destroy or overwrite the page's optimization for those other targets. If there is a direct collision of search intent, you must recommend separating the content (e.g. creating a new informational blog post) rather than modifying this page and risking its other rankings.`;
      }
    }
  }

  let prompt = '';

  if (type === 'ctr') {
    const liveData = await fetchLivePageData(item.page);
    const queryList = (item.queries || [{ query: item.query, impressions: item.impressions, position: item.position }]);
    const queryBreakdown = queryList.map((q: any) => `- "${q.query}" (Pos: ${q.position?.toFixed(1)}, Imps: ${q.impressions}, CTR: ${(q.ctr * 100).toFixed(1)}%)`).join('\n');
    prompt = `
      You are an elite, human-centric SEO copywriter.
      A single page ranking on Google is dramatically underperforming on Click-Through Rate (CTR) for multiple queries. 
      You must craft highly-optimized Title Tag and Meta Description options that strategically cover the target keywords, BUT they must sound deeply natural, highly clickable, and human-written.
      
      URL SLUG: ${item.page}
      Current Live H1: ${liveData?.h1 || 'Unknown'}
      Current Live Title: ${liveData?.title || 'Unknown'}
      Current Live Meta Description: ${liveData?.metaDescription || 'Unknown'}
      
      Underperforming Queries for this URL:
      ${queryBreakdown}
      
      Provide exactly 3 highly-optimized Title Tag options (under 60 characters each) and 1 Meta Description (under 155 characters).
      
      CRITICAL SEO RULES:
      1. ANALYZE THE PAGE TYPE: If the URL contains "/blog/" or the H1 reads like an article, you MUST write an editorial, journalistic title (e.g., "7 Best AI Photo Restoration Techniques for 2026"). Do NOT write robotic SaaS feature-page titles (e.g., "AI Photo Restoration | Best Techniques") for a blog post.
      2. ZERO KEYWORD STUFFING: Do not mindlessly force the exact keyword string if it breaks natural English grammar. The title must read like a premium, human-authored publication. 
      3. DRIVE CURIOSITY & INTENT: Utilize curiosity gaps or strong intent matching. If they search for "techniques 2026", they want an updated, definitive guide. Promise them that.
      4. RESPECT THE ORIGINAL H1: Do not hallucinate a totally separate topic. Ground your new title tightly around the existing H1 and URL slug.
      5. BAN AI BOILERPLATE: Absolutely NO generic AI phrasing. Do NOT use words like "Unlock", "Explore", "Discover", "Dive into", "Unleash", "Elevate", "Cutting-edge", or "Ultimate guide". Descriptions must be direct, punchy, and state the exact value proposition without marketing fluff.
${crossSignalAlert}
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'cannibalization') {
    const pageMetrics = item.pages.map((p: any) => `- URL: ${p.url} | Impressions: ${p.impressions} | Position: ${(p.position || 0).toFixed(1)}`).join('\n');
    prompt = `
      You are an elite Technical SEO.
      The following URLs are cannibalizing each other for the keyword "${item.query}", meaning search engines are splitting authority between them:
      ${pageMetrics}
      
      CRITICAL INSTRUCTION - THE MATH DETERMINES THE WINNER:
      1. Analyze the exact Impressions and Position of the URLs above. 
      2. The URL with significantly higher Impressions or a much better Position is the "Mathematical Winner" in Google's eyes.
      3. Do NOT automatically assume the feature/service page is the winner. If a blog post is getting all the traffic, the blog post is the winner.
      
      YOUR TASK: Write a step-by-step strategy document for the website owner guiding them on how to fix this cannibalization. Base your advice on the mathematical winner:
      - If the WINNER is the Informational Blog Post: Advise the user to keep the blog post and inject aggressive transactional CTAs into it to drive conversions. Then, instruct them to de-optimize the struggling feature page for this specific keyword so it stops competing.
      - If the WINNER is the Transactional Feature Page: Advise the user to de-optimize the blog post by stripping the keyword from the blog's H1/Title, and retarget the blog to a different long-tail query instead.
      - If both pages are identical in intent (e.g. two service pages): Only then should you instruct the user to set up a 301 redirect or canonical tag from the losing page to the winning page.
      
      Provide a definitive, structured Markdown strategy. Use headers (##) and bullet points. You are speaking directly to the website owner. Never use conversational AI fluff like "As an SEO...".${crossSignalAlert}
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'striking') {
    prompt = `
      You are an elite Technical SEO.
      We need to push the page ${item.page} to Page 1 for the query "${item.query}". It is currently in "Striking Distance" (Page 2).
      
      YOUR TASK: Provide a definitive content upgrade strategy for this specific page. What exact H2 header and paragraph topics should be added to boost its relevancy for this query?
      
      CROSS-REFERENCE THE BRAND DNA:
      Only recommend adding H2s, FAQs, or paragraph topics that actually align with the existing "Brand Context". Do NOT invent or promise capabilities the product does not offer just to satisfy the keyword. If the keyword demands a feature we lack, pivot your recommended H2s to an informational/educational angle (e.g., "How to solve X using [Our Product's actual feature]").${crossSignalAlert}
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'decay') {
    prompt = `
      You are an elite SEO Strategist.
      We have detected "Content Decay". The query "${item.query}" ranking on the page: ${item.page} has lost traffic.
      Clicks dropped from ${item.prevClicks} to ${item.currentClicks}.
      
      YOUR TASK: Provide a highly specific, strategic directive on what exact sections or FAQs to add to reverse this content decay.
      
      CROSS-REFERENCE THE BRAND DNA:
      Only recommend adding content that strictly aligns with the "Brand Context" below. Do NOT invent new software features. Fix the decay tightly around what the brand actually does.${crossSignalAlert}
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'emerging') {
    const liveData = await fetchLivePageData(item.page);
    prompt = `
      You are an elite SEO Strategist.
      We have detected an "Emerging Trend". The query "${item.query}" has suddenly gained ${item.impressions} impressions this month, currently triggering on URL: ${item.page}.
      
      The live page's current Title is: "${liveData?.title || 'Unknown'}" and H1 is: "${liveData?.h1 || 'Unknown'}".
      
      YOUR TASK: Based on the gap between the new query intent and the current page's focus, give a concrete, logical action plan to capture this traffic safely.
      
      CROSS-REFERENCE THE BRAND DNA (THE REALITY CHECK):
      1. Check the provided "Brand Context". Does the query "${item.query}" map directly to an EXISTING core feature or UVP?
      2. If YES (Feature Match): Advise updating the current page OR creating a dedicated "Trojan Horse" feature landing page.
      3. If NO (Brand Mismatch): You are strictly FORBIDDEN from recommending a fake feature page. Instead, instruct the user to create a highly optimized "Informational Blog Article" (e.g. "Top Tools to do X") that captures the search traffic and softly pitches the related actual brand features.${crossSignalAlert}
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'aeo') {
    prompt = `
      You are an elite Answer Engine Optimization (AEO) expert.
      We detected a massive intent shift. The query "${item.query}" on page ${item.page} maintained impressions (${item.prevImps} -> ${item.currentImps}) but clicks crashed (${item.prevClicks} -> ${item.currentClicks}). 
      Google is likely answering this via AI Overviews.
      
      Produce a rigid, factual, direct-answer HTML structure using <h2>, <ul> or <ol> that answers the query perfectly so LLMs will cite this page as the source. Keep it under 200 words.${crossSignalAlert}
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  }

  const generateConfig: any = {};
  if (type === 'ctr') {
    generateConfig.responseMimeType = 'application/json';
    generateConfig.responseSchema = {
      type: Type.OBJECT,
      properties: {
        titles: { type: Type.ARRAY, items: { type: Type.STRING } },
        metaDescription: { type: Type.STRING }
      },
      required: ["titles", "metaDescription"]
    };
  } else if (type === 'cannibalization') {
    generateConfig.responseMimeType = 'application/json';
    generateConfig.responseSchema = {
      type: Type.OBJECT,
      properties: {
        markdownStrategy: { 
            type: Type.STRING, 
            description: "The pure, beautifully formatted Markdown strategy. No conversational intro/outro. Use ## Headers and bullet points." 
        }
      },
      required: ["markdownStrategy"]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: generateConfig,
  });

  let adviceText = response.text || '';
  if (!adviceText) return { advice: '' };

  // For cannibalization, extract the pure markdown 
  if (type === 'cannibalization') {
    try {
        const parsed = JSON.parse(adviceText);
        if (parsed.markdownStrategy) {
            adviceText = parsed.markdownStrategy;
        }
    } catch (parseError) {
        console.error("Failed to parse markdownStrategy JSON from LLM response");
    }
  }

  const supabase = await createClient();
  const timestamp = new Date().getTime();
  const cleanSiteName = siteUrl.replace(/^sc-[a-z]+:/, '').replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.\-]/g, '_');
  const storagePath = `${userId}/${cleanSiteName}/${type}-${timestamp}.md`;
  
  const { error: storageError } = await supabase.storage.from('seo-strategies').upload(storagePath, adviceText, { contentType: 'text/markdown' });
  if (storageError) console.error("Storage upload failed:", storageError);

  const pageUrl = type === 'cannibalization' ? item.pages?.[0]?.url : item.page;

  // Save the draft explicitly
  const { data: playRecord, error: dbError } = await supabase.from('seo_plays').insert({
    user_id: userId,
    site_url: siteUrl,
    query: type === 'ctr' ? (item.primaryQuery || item.query) : item.query,
    page: pageUrl || '',
    play_type: type,
    advice: storagePath,
    status: 'draft'
  }).select('id').single();

  if (dbError) console.error("Failed to insert draft:", dbError);

  revalidatePath('/action-board', 'page');
  return { advice: adviceText, play_id: playRecord?.id };
}

export async function getStrategyContent(advicePath: string) {
  if (advicePath.endsWith('.md') || advicePath.includes('/')) {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from('seo-strategies').download(advicePath);
    if (!error && data) {
      return await data.text();
    }
    return 'Failed to download strategy from storage.';
  }
  // Fallback for legacy database rows that stored raw text directly
  return advicePath;
}

export async function markPlayAsDeployed(playId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from('seo_plays')
    .update({ 
      status: 'deployed',
      deployed_at: new Date().toISOString()
    })
    .eq('id', playId)
    .eq('user_id', user.id);

  if (error) throw new Error("Failed to deploy draft strategy");
  return { success: true };
}

export async function setGscSite(siteUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: connection, error } = await supabase
    .from("gsc_connections")
    // Stamp the lock immediately on the first standalone fetch
    .update({ 
        site_url: siteUrl,
        last_fetched_at: new Date().toISOString()
    })
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !connection) {
    throw new Error("Failed to save GSC site preference");
  }

  // Trigger the background task for the initial 60-day sync instantly
  try {
    const { syncGscDataTask } = await import("@/trigger/gsc-sync");
    await syncGscDataTask.trigger({
        userId: user.id,
        connectionId: connection.id,
        siteUrl: siteUrl,
        isInitialSync: true
    });
    console.log(`[seo-board action] Initial GSC sync triggered for ${siteUrl}`);
  } catch (syncError) {
    console.error("[seo-board action] Failed to trigger initial GSC sync", syncError);
  }

  revalidatePath("/action-board");
}
