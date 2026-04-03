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

export async function generateActionableFix(type: 'ctr' | 'striking' | 'cannibalization' | 'emerging' | 'decay', item: any, siteUrl: string, fullContext?: any) {
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

      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'cannibalization') {
    prompt = `
      You are an elite Technical SEO.
      The following URLs are cannibalizing each other for the keyword "${item.query}":
      ${item.pages.map((p: any) => `- ${p.url}`).join('\n')}
      
      Provide a definitive technical directive on how to resolve this conflict (e.g., 301 redirect or rel=canonical).
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'striking') {
    prompt = `
      You are an elite Technical SEO.
      We need to push the page ${item.page} to Page 1 for the query "${item.query}". It is currently in "Striking Distance" (Page 2).
      
      Provide a definitive content upgrade strategy for this specific page. What exact H2 header and paragraph topics should be added to boost its relevancy for this query?
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'decay') {
    prompt = `
      You are an elite SEO Strategist.
      We have detected "Content Decay". The query "${item.query}" ranking on the page: ${item.page} has lost traffic.
      Clicks dropped from ${item.prevClicks} to ${item.currentClicks}.
      
      Provide a highly specific, strategic directive on what exact sections or FAQs to add to reverse this content decay.
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'emerging') {
    const liveData = await fetchLivePageData(item.page);
    prompt = `
      You are an elite SEO Strategist.
      We have detected an "Emerging Trend". The query "${item.query}" has suddenly gained ${item.impressions} impressions this month, currently triggering on URL: ${item.page}.
      
      The live page's current Title is: "${liveData?.title || 'Unknown'}" and H1 is: "${liveData?.h1 || 'Unknown'}".
      
      Based on the gap between the new query intent and the current page's focus, should we update the existing page, or create a new dedicated "Trojan Horse" post specifically targeted at "${item.query}"? Give a concrete, logical action plan.
      Brand Context (Positioning Only): ${JSON.stringify(strategicPositioning)}
    `;
  } else if (type === 'aeo') {
    prompt = `
      You are an elite Answer Engine Optimization (AEO) expert.
      We detected a massive intent shift. The query "${item.query}" on page ${item.page} maintained impressions (${item.prevImps} -> ${item.currentImps}) but clicks crashed (${item.prevClicks} -> ${item.currentClicks}). 
      Google is likely answering this via AI Overviews.
      
      Produce a rigid, factual, direct-answer HTML structure using <h2>, <ul> or <ol> that answers the query perfectly so LLMs will cite this page as the source. Keep it under 200 words.
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
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: generateConfig,
  });

  const adviceText = response.text || '';
  if (!adviceText) return { advice: '' };

  const supabase = await createClient();
  const timestamp = new Date().getTime();
  // We use user_id structure for RLS policy enforcement
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
    advice: storagePath, // Stores file path, not megabytes of text
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
    .update({ site_url: siteUrl })
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
