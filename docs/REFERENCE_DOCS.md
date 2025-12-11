# SEO Writer Application - Reference Documentation

> **Purpose:** This document explains how each feature of the SEO Writer app works in plain, natural language. Use this as a quick reference to understand the flows, data usage, and where everything connects.

---

## Table of Contents
1. [Onboarding Flow](#1-onboarding-flow)
2. [Brand Details (Brand DNA)](#2-brand-details-brand-dna)
3. [Content Plan Generation](#3-content-plan-generation)
4. [Blog Writer Page](#4-blog-writer-page)
5. [Article Generation](#5-article-generation)
6. [Articles List & Publishing](#6-articles-list--publishing)
7. [Settings Page](#7-settings-page)
8. [Integrations (CMS Publishing)](#8-integrations-cms-publishing)
9. [Google Search Console (GSC)](#9-google-search-console-gsc)

---

## 1. Onboarding Flow

### What It Does
The onboarding flow is the first thing new users see. It walks them through setting up their brand identity, analyzing competitors, and creating a 30-day content plan.

### The Steps
The onboarding has **3 main phases** (displayed as progress indicators at the top):

1. **Brand DNA** (Step 1)
2. **Content Plan** (Steps 2-3: Competitors + Plan)
3. **GSC Insights** (Optional, Step 4+)

### How It Works

#### Step 1: Brand DNA
- User enters their website URL (e.g., `https://example.com`)
- The app crawls the website using **Tavily API** (fetches up to 10 pages: homepage, about, features, pricing, blog)
- The crawled content is sent to **Gemini AI** which extracts:
  - Product name & identity (literally, emotionally, what it's NOT)
  - Mission statement
  - Target audience & their psychology
  - Brand enemies (what they fight against)
  - Unique value propositions
  - Core features
  - Pricing info
  - How it works steps
  - **Style DNA** - A comprehensive writing style guide (tone, voice, perspective)
- User can review/edit all extracted fields
- On "Save", brand data is stored in the `brand_details` database table

#### Step 2: Competitor Analysis
- Automatically starts after brand is saved
- Calls `/api/analyze-competitors` with the brand context
- **Smart Category-Based Discovery** (works for ANY brand, even new ones):
  1. AI extracts the product category from your brand context (e.g., "AI photo restoration tool")
  2. Generates search queries like "best AI photo restoration tools 2024"
  3. Searches for competitors in that category (NOT by your brand name)
  4. This approach works even if your brand is completely new/unknown
- Finds competitor websites and extracts their content themes
- Extracts "seed" keywords/topics from competitor content
- This data is stored temporarily and passed to the next step

#### Step 3: Content Plan Generation
- Calls `/api/generate-content-plan` with competitor seeds + brand data
- AI generates a **30-day content plan** with:
  - Article titles
  - Main keywords
  - Supporting keywords
  - Article type (informational, commercial, how-to)
  - Scheduled dates
  - Content clusters
- Plan is saved to `content_plans` table when user clicks "Save Plan"

#### Step 4-6: GSC Connection (Optional)
- User is asked if they want to connect Google Search Console
- If yes: Redirects to Google OAuth
- After connecting, user selects their site
- The app fetches GSC data and enhances the content plan with:
  - High-impact opportunities (high impressions, poor ranking)
  - Quick wins (already on page 1/2, needs re-optimization)
  - Low CTR pages (need title/meta improvements)
- Enhanced plan is saved with `gsc_enhanced: true`

### Where Data Goes
| Data | Stored In | Used For |
|------|-----------|----------|
| Brand details | `brand_details` table | Article generation, style guidance |
| Style DNA | Inside `brand_details.style_dna` | Writing style for all articles |
| Content plan | `content_plans` table | 30-day article calendar |
| GSC tokens | `gsc_connections` table | Fetching search data |

### Persistence
The onboarding progress is saved to `localStorage` using these keys:
- `onboarding_step` - Current step
- `onboarding_brand_url` - Website URL
- `onboarding_brand_data` - Extracted brand data
- `onboarding_brand_id` - Saved brand ID
- `onboarding_competitors` - Competitor data
- `onboarding_content_plan` - Generated plan
- `onboarding_plan_id` - Saved plan ID

This means users can close the page and resume later.

---

## 2. Brand Details (Brand DNA)

### What It Contains
The Brand DNA is a structured profile of your business:

```
product_name        → The name of your product/brand
product_identity    → 
  - literally       → What it literally is (e.g., "AI writing tool")
  - emotionally     → What it emotionally represents (e.g., "freedom from writer's block")
  - not             → What it is NOT (e.g., "not a content spinner")
mission             → Why you exist
audience            → 
  - primary         → Who your main customers are
  - psychology      → Their desires, fears, motivations
enemy               → List of things you fight against
uvp                 → Unique value propositions (what makes you different)
core_features       → Main features framed as customer benefits
pricing             → Pricing plans/tiers
how_it_works        → Steps of your process
image_style         → Featured image style preference (stock, illustration, etc.)
style_dna           → Comprehensive writing voice guide
```

### How It's Fetched
1. **Automatic extraction** via `/api/analyze-brand`:
   - Tavily crawls the website (up to 10 pages)
   - Gemini analyzes and structures the data
   
2. **Manual entry**: Users can skip crawling and enter details manually

### How It's Displayed
- In the onboarding flow as editable form fields
- Each section has its own expandable area
- Arrays (like `enemy`, `uvp`, `core_features`) are displayed as multi-line textareas (one item per line)

### Where It's Used
- **Article generation**: Brand context is injected into AI prompts
- **Style DNA**: Used to control writing tone, perspective, formality
- **Content planning**: Used to generate brand-relevant topics
- **Title generation**: Ensures titles match brand voice

---

## 3. Content Plan Generation

### What It Is
A 30-day calendar of blog post ideas, each with:
- Title
- Main keyword (primary SEO target)
- Supporting keywords (secondary SEO targets)
- Article type (informational, commercial, how-to)
- Scheduled date
- Status (pending, writing, published)
- Optional: GSC metrics (impressions, position, CTR)
- Optional: Opportunity badge (high_impact, quick_win, low_ctr, new_opportunity)

### How It's Generated
1. **Competitor analysis** finds topics your competitors cover
2. **AI generates plan** based on:
   - Competitor seed topics
   - Your brand identity
   - Strategic content mix (informational + commercial + how-to)

### How GSC Enhancement Works
If you connect Google Search Console:
1. App fetches your actual search query data
2. Identifies opportunities:
   - **High Impact**: High impressions but ranking on page 2+ (positions 11-30)
   - **Quick Win**: Good position (top 10) but potential for improvement
   - **Low CTR**: High impressions but people aren't clicking (title/meta issue)
   - **New Opportunity**: Emerging queries you haven't targeted
3. AI combines your existing plan with GSC data to prioritize topics
4. Adds badges and metrics to help you focus on highest-value content

### How It's Displayed
- `/content-plan` page shows all items in a card layout
- Filter tabs: All | Pending | Writing | Published
- "Top Priority" section shows urgent items (high_impact, quick_win badges)
- Each item shows:
  - Schedule date badge
  - Title
  - Type badge (Informational/Commercial/How-To)
  - Keywords
  - GSC metrics (if enhanced)
  - Strategic reason (if provided)
- Actions: Edit | Change Status | Write (generates article)

---

## 4. Blog Writer Page

### What It Does
This is the manual article creation page. Users enter a keyword and generate articles from scratch.

### The Flow
1. **Check brand**: Page loads user's default brand from `getUserDefaults()`
2. **No brand?** → Redirect to `/onboarding`
3. **Enter keyword**: User types target keyword
4. **Select article type**: Informational, Commercial, or How-To
5. **Generate titles**: Calls `/api/generate-titles` with keyword + brandId + type
   - Returns 5+ title suggestions tailored to brand voice
6. **Select title**: User picks their preferred title
7. **Generate article**: Calls `/api/generate` to trigger background job
   - Redirects to `/articles` to show progress

### What Gets Passed to Article Generation
- `keyword` - Main SEO keyword
- `brandId` - Links to brand_details for style/voice
- `title` - The selected title
- `articleType` - Type of article (affects structure/approach)

---

## 5. Article Generation

### What It Is
A multi-phase background job that creates SEO-optimized, brand-aligned articles.

### The Phases (in order)
1. **Research**: Crawls top-ranking content for the keyword
2. **Fact Sheet**: Extracts key facts, statistics, angles from research
3. **Outline**: Creates H2/H3 structure based on research + brand
4. **Section Writing**: Writes each section individually using style DNA
5. **Polish/Edit**: Refines the full draft for consistency
6. **SEO Meta**: Generates slug, meta title, meta description
7. **Featured Image**: Generates image based on brand's `image_style` preference

### How Style DNA Is Used
The `style_dna` paragraph is injected into writing prompts. It tells the AI:
- What perspective to use (I/We/You/third-person)
- What tone to maintain (professional, casual, friendly, authoritative)
- Sentence style preferences (short punchy vs. detailed)
- Words/phrases to avoid
- Unique brand quirks

### How Progress Is Tracked
- Article status in database: `queued` → `processing` → `completed` (or `failed`)
- `current_step_index` updates as each phase completes
- Real-time updates via Supabase realtime subscriptions
- Users see live progress on the articles page

### What Gets Stored
| Field | Contents |
|-------|----------|
| `final_html` | The complete article as HTML |
| `final_markdown` | The article as Markdown |
| `title` | Article title |
| `meta_description` | SEO meta description |
| `slug` | URL-friendly slug |
| `featured_image_url` | Generated/uploaded image URL |
| `outline_data` | JSON structure of headings |
| `research_data` | Raw research from Tavily |

---

## 6. Articles List & Publishing

### What It Shows
The `/articles` page displays all generated articles in a table:
- Keyword
- Status (Completed, Processing, Failed, Queued)
- Progress (Step number or "Done")
- Date created
- Actions (Edit, Publish)

### Real-Time Updates
The page subscribes to Supabase realtime changes on the `articles` table:
- New articles appear immediately
- Status changes are reflected live
- No page refresh needed

### Publishing Flow
1. User clicks "Publish" on a completed article
2. Modal appears with platform selection:
   - WordPress (if connected)
   - Webflow (if connected)
   - Shopify (if connected)
3. User selects platform and clicks "Publish as Draft"
4. API is called (`/api/wordpress/publish`, `/api/webflow/publish`, or `/api/shopify/publish`)
5. Article is created as a draft on the chosen platform
6. Toast appears with success + "View" link
7. Database is updated with `wordpress_post_url`, `webflow_item_id`, or `shopify_article_id`

### Published Platform Badges
After publishing, small icons appear next to the article:
- WP = WordPress
- WF = Webflow
- SP = Shopify

---

## 7. Settings Page

### What It Does
Manages brand configurations (not CMS integrations—those are in `/integrations`).

### Features
- View all configured brands
- Select default brand (used for article generation)
- Edit existing brand details
- Delete brands
- Add new brands (up to plan limit)

### Adding/Editing Brands
Uses the same `BrandOnboarding` component as the full onboarding:
1. Enter website URL
2. Auto-analyze with Tavily + Gemini
3. Review/edit extracted data
4. Save

### Brand Limit
User plans have brand limits. The page shows "Your Brands (X / Y)" where Y is the limit.

---

## 8. Integrations (CMS Publishing)

### What It Is
The `/integrations` page manages connections to external publishing platforms.

### Supported Platforms

#### WordPress
**Required Info:**
- Site URL (e.g., `https://yourblog.com`)
- Username
- Application Password (NOT your regular password)

**How to get App Password:**
WordPress Admin → Users → Profile → Application Passwords

**What's Stored:**
- `site_url`, `username`, encrypted `app_password`

---

#### Webflow
**Required Info:**
- API Token (from Project Settings → Integrations)

**Setup Flow:**
1. Enter API token
2. Token is verified, sites are fetched
3. Select a site
4. Select a CMS collection (where articles go)

**What's Stored:**
- `api_token`, `site_id`, `site_name`, `collection_id`

---

#### Shopify
**Required Info:**
- Store domain (e.g., `mystore` or `mystore.myshopify.com`)
- Admin API Access Token (starts with `shpat_`)

**How to get Access Token:**
1. Shopify Admin → Settings → Apps → Develop apps
2. Create custom app
3. Configure Admin API scopes: `read_content`, `write_content`
4. Install app → Get Admin API token

**Setup Flow:**
1. Enter domain + token
2. Connection is verified, blogs are fetched
3. Select which blog to publish to

**What's Stored:**
- `store_domain`, `access_token`, `store_name`, `blog_id`, `blog_title`

### Default Connection
Each platform can have a "default" connection. When publishing, the default is used automatically.

---

## 9. Google Search Console (GSC)

### What It Does
Connects your Google Search Console data to enhance content planning with real search performance data.

### Connection Flow
1. User clicks "Connect GSC" during onboarding
2. Redirects to Google OAuth consent screen
3. User grants access
4. Callback saves tokens to `gsc_connections` table
5. User selects which site to use (if multiple verified sites)

### What Data Is Fetched
- **Queries**: Search terms people use to find you
  - Impressions (how often you appear)
  - Clicks
  - Position (average ranking)
  - CTR (click-through rate)
- **Pages**: Which of your pages appear in search
  - Same metrics as queries

### How Data Is Used
1. **During onboarding**: Enhances the 30-day content plan with real opportunities
2. **Strategic categorization**:
   - High impressions + position 11-30 = **High Impact** (you're close to page 1!)
   - Position 1-10 + low CTR = **Low CTR** (fix your title/description)
   - Good position + room to improve = **Quick Win**

### Data Privacy
- GSC tokens are encrypted and stored per-user
- Data is fetched on-demand, not continuously synced
- Users can disconnect at any time

---

## Quick Reference: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ONBOARDING                                 │
│  URL → Tavily (crawl) → Gemini (analyze) → brand_details            │
│  Competitors → Seeds → Content Plan → content_plans                 │
│  GSC OAuth → gsc_connections → Enhanced Plan                        │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        BLOG WRITER                                   │
│  Keyword + Brand → /api/generate-titles → Titles                    │
│  Selected Title → /api/generate → Trigger.dev job                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     ARTICLE GENERATION                               │
│  Research → Fact Sheet → Outline → Write Sections → Polish → SEO   │
│  Uses: brand_details, style_dna, research_data                      │
│  Outputs: final_html, meta_description, featured_image              │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         PUBLISHING                                   │
│  /articles page → Select Platform → /api/{platform}/publish         │
│  Creates draft on WordPress/Webflow/Shopify                         │
│  Updates: wordpress_post_url / webflow_item_id / shopify_article_id │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Tables Reference

| Table | Primary Purpose |
|-------|-----------------|
| `brand_details` | Stores brand identity + style_dna |
| `content_plans` | 30-day content calendars |
| `articles` | Generated articles + status + outputs |
| `wordpress_connections` | WordPress site credentials |
| `webflow_connections` | Webflow API tokens + site/collection |
| `shopify_connections` | Shopify store credentials + blog selection |
| `gsc_connections` | Google Search Console OAuth tokens |
| `user_preferences` | Default brand + other user settings |

---

*Last Updated: December 2024*
