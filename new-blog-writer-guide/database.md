Here is the complete **database.md** file.

It includes the SQL schema optimized for **Supabase (PostgreSQL)**, specifically designed to handle the JSON structures (`Style_DNA`, `Fact_Sheet`, `Outline`) and the state management for your long-running Trigger.dev jobs.

***

# Database Schema & SQL Setup

## Overview
This schema is designed for the **Authentic Blog Agent**. It utilizes `JSONB` columns heavily to store the variable AI outputs from the different phases (Research, Style, Outline) without requiring constant schema migrations.

**Key Features:**
*   **Row Level Security (RLS):** Enabled by default. Users can only access their own data.
*   **Real-time Ready:** The `articles` table is designed to trigger Supabase Realtime events so the frontend updates as the AI writes.
*   **Enums:** Strict typing for the Article Status to manage the UI state.

## 1. Initial Setup (Enums & Extensions)

Run this block first to set up the data types.

```sql
-- Enable UUID extension (usually on by default in Supabase, but good to ensure)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define the Status Enum for the Article Workflow
-- This matches the UI states exactly.
CREATE TYPE article_status AS ENUM (
  'queued',        -- User submitted, waiting for Trigger.dev
  'researching',   -- Phase 2: Scraping & Gap Analysis
  'outlining',     -- Phase 3: Gemini 3 Pro building structure
  'writing',       -- Phase 4: Snowball Loop in progress
  'polishing',     -- Phase 5: Final Humanizer Pass
  'completed',     -- Ready for download
  'failed'         -- Job crashed (check error_message)
);
-- Enum to record the phase where a failure occurred
CREATE TYPE article_phase AS ENUM (
  'research',
  'outline',
  'writing',
  'polish',
  'trigger'
);
```

## 2. Table: `profiles` (User Management)

Standard table to link Supabase Auth to your application logic (subscription tiers, credits).

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  credits_remaining INTEGER DEFAULT 3, -- Free trial: 3 articles
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'pro', 'agency'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 3. Table: `brand_voices` (Phase 1 Data)

Stores the "Style DNA" extracted with Tavily + Gemini 3 pro with reasoning enabled.

```sql
CREATE TABLE brand_voices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- The name the user gives this voice (e.g., "LinkedIn Vibe", "Serious Tech")
  name TEXT NOT NULL,
  
  -- Phase 1 Output: The detailed JSON object containing tone, structure rules, etc.
  style_dna JSONB NOT NULL,
  
  -- Optional: If they scraped a URL, keep it for reference
  source_url TEXT,
  
  -- Is this the default voice for new articles?
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by user
CREATE INDEX idx_brand_voices_user ON brand_voices(user_id);
```

## 4. Table: `articles` (The Master Workflow)

This is the core table where the background job reads/writes during Phases 2, 3, 4, and 5.

```sql
CREATE TABLE articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  voice_id UUID REFERENCES brand_voices(id), -- The style used for this article
  
  -- User Input
  keyword TEXT NOT NULL,
  
  -- Workflow State
  status article_status DEFAULT 'queued',
  
  -- Phase 2 Output: Research & Gap Analysis
  -- Contains: { "fact_sheet": [], "content_gap": {}, "sources": [] }
  competitor_data JSONB,
  
  -- Phase 3 Output: The Structure
  -- Contains: { "title": "...", "sections": [ { "heading": "...", "note": "..." } ] }
  outline JSONB,
  
  -- Phase 4 Tracking: Snowball Loop
  -- Tracks which section (H2) we are currently writing (0 to N)
  current_step_index INTEGER DEFAULT 0,
  
  -- Phase 4 Output: Raw Markdown Draft
  -- Updated continuously after every loop iteration
  raw_content TEXT DEFAULT '',
  
  -- Phase 5 Output: Final Polished HTML
  final_html TEXT,
  
  -- Debugging
  error_message TEXT,
  failed_at_phase article_phase,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Dashboard filtering
CREATE INDEX idx_articles_user ON articles(user_id);
CREATE INDEX idx_articles_status ON articles(status);
```

## 5. Security (Row Level Security)

**Crucial:** These policies ensure User A cannot see User B's articles or voices.

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Policies for PROFILES
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for BRAND VOICES
CREATE POLICY "Users can view own voices" 
  ON brand_voices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own voices" 
  ON brand_voices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voices" 
  ON brand_voices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voices" 
  ON brand_voices FOR DELETE USING (auth.uid() = user_id);

-- Policies for ARTICLES
CREATE POLICY "Users can view own articles" 
  ON articles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own articles" 
  ON articles FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Important: We allow UPDATE so the user can potentially edit the title/keyword, 
-- but strictly speaking, Trigger.dev uses a Service Role Key (Admin) to bypass this for backend updates.
CREATE POLICY "Users can update own articles" 
  ON articles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own articles" 
  ON articles FOR DELETE USING (auth.uid() = user_id);
```

## 6. Automations (Timestamps)

Ensures `updated_at` is always accurate when Trigger.dev updates a row.

```sql
-- Reusable function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to profiles
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Apply to articles
CREATE TRIGGER update_articles_modtime
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

## 7. Instructions for Cursor/Windsurf

1.  Copy all the SQL code above.
2.  Go to the **Supabase Dashboard** -> **SQL Editor**.
3.  Paste the code and click **Run**.
4.  **Verification:** Go to the Table Editor and ensure `articles` has columns `competitor_data` (jsonb) and `status` (enum).