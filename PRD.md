# Product Requirements Document (PRD): Flipaeo Strategic SEO Engine

**Project Name:** Flipaeo Strategic SEO Engine (Integration)
**Status:** Draft / Feature Specification
**Target Platform:** flipaeo.com
**Date:** April 2, 2026

---

## 1. Executive Summary
Flipaeo is evolving from a content engine into a **Strategic SEO Command Center**. This new feature set integrates real-time Google Search Console (GSC) data with a proprietary "Brand DNA" framework to provide AI-driven, actionable SEO directives. Unlike generic SEO tools, this system ensures that all content strategies and optimizations are strictly aligned with the business's actual product capabilities and monetization goals.

## 2. The Problem
Modern SEO is no longer just about ranking; it's about **Strategic Alignment**. 
- **Data Overload:** Users have access to GSC but don't know how to interpret "Bleeding" vs. "Quick Wins."
- **AI Hallucinations in Strategy:** Generic AI SEO tools suggest building features or targeting audiences that the business doesn't actually support.
- **Fragmented Workflow:** Strategy is often disconnected from real-time performance data.

## 3. The Solution: Flipaeo Strategic Engine
A unified dashboard that connects directly to the source of truth (GSC) and filters all AI insights through a "Brand DNA" lens(Where we already own teh rband dna in our exisitng main app).

---

## 4. Feature Specifications

### 4.1 Google Search Console (GSC) Data Engine -{in the past we tried to use this but it was not successful, we need to make sure we do it right this time. GSC integration part oauth and all the api integration part was already built in initial version of flipaeo. I want you to use the best practices and make sure it is done right this time.}
*   **Description:** Secure OAuth2 integration with Google Search Console.
*   **Functionality:**
    *   Real-time fetching of site properties.
    *   Granular performance metrics (Clicks, Impressions, CTR, Average Position).
    *   Time-series analysis for 24h, 7-day, and 30-day windows.
*   **Integration Value:** Provides the raw data needed for evidence-based strategy.

### 4.2 Brand DNA Profiler (The Strategic Guardrails)
*   **Description:** A mandatory profiling module that defines the "Reality" of the business.
*   **Key Data Points:**
    *   **Product Description:** Concise definition of the value prop.
    *   **Core Features (Strict Boundary):** A whitelist of supported features. AI will *never* suggest content for features outside this list.
    *   **Target Audience:** Who the product is actually for.
    *   **Monetization Strategy:** How the site makes money (e.g., SaaS, Affiliate, Ads).
*   **Sync Logic:** Stored in Firestore for cross-device persistence and real-time AI context.

### 4.3 Expert Directives (The "Brain")
*   **Description:** An AI-powered analysis engine that categorizes GSC data into four strategic quadrants.
*   **Quadrants:**
    *   **Top Wins:** High-performing keywords to protect and double down on.
    *   **Bleeding:** Significant drops in performance requiring immediate triage.
    *   **Quick Wins:** Low-hanging fruit (e.g., keywords on Page 2) that can move to Page 1 with minimal effort.
    *   **Target:** High-intent keywords aligned with Brand DNA that aren't yet captured.
*   **Value:** Turns raw numbers into a "To-Do" list for content teams.

### 4.4 Interactive AI SEO Assistant(i build this but we dont need it right now)
*   **Description:** A context-aware chatbot that "lives" inside the data.
*   **Capabilities:**
    *   Answers questions like "Why did my impressions drop for [Keyword]?"
    *   Suggests content outlines based on "Quick Wins."
    *   Filters all advice through the Brand DNA to ensure strategic relevance.

---

## 5. Integration into Flipaeo.com

### 5.1 User Flow
1.  **Onboarding:** User connects their GSC account to Flipaeo on a complete new page /strategic-seo. properties are fethced, user chosoes teh right one and they are saved in supabase, no chanegs after that.(we will sue complte new tabels for everything,, so that our exisitng app doenst break)
2.  **Command Center:** User enters the new strategic dashboard, seeing their "Expert Directives" immediately.
3.  **Execution:** User clicks a "Quick Win" directive, and Flipaeo's core content engine generates a strategic article or update to capture that traffic.

### 5.2 Technical Architecture
*   **Frontend:** React/Next.js with Framer Motion for a premium, high-density dashboard experience.
*   **Backend:** supabase.
*   **AI Layer:** Gemini 3.1 Pro for high-reasoning strategic analysis, utilizing the GSC data as "Grounding" context.

---

## 6. Success Metrics (KPIs)
*   **Strategic Lift:** Increase in CTR for "Quick Win" keywords within 30 days of implementation.
*   **Retention:** Daily/Weekly active usage of the "Expert Directives" tab.
*   **AEO Readiness:** Improved visibility in AI-search results (Perplexity, Gemini, SearchGPT) due to highly specific, Brand-DNA-aligned content.

---

## 7. Future Roadmap
*   **Automated Triage:** AI automatically creates "Drafts" in Flipaeo when a "Bleeding" keyword is detected.
*   **Competitor DNA:** Comparing the user's Brand DNA against competitor search footprints.
