-- Migration to fix missing or non-functional CASCADE DELETE constraints for brand-related data

-- 1. Fix internal_links cascade
-- We drop the constraint first because it might exist without CASCADE if the column was added manually or skipped via IF NOT EXISTS in previous migrations.
ALTER TABLE internal_links 
DROP CONSTRAINT IF EXISTS internal_links_brand_id_fkey,
ADD CONSTRAINT internal_links_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES brand_details(id) ON DELETE CASCADE;

-- 2. Fix articles cascade
-- In some versions of the schema, this column might still be named 'voice_id'
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'voice_id') THEN
    ALTER TABLE articles RENAME COLUMN voice_id TO brand_id;
  END IF;
END $$;

ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_voice_id_fkey,
DROP CONSTRAINT IF EXISTS articles_brand_id_fkey,
ADD CONSTRAINT articles_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES brand_details(id) ON DELETE SET NULL;

-- 3. Fix content_plans cascade
-- Changing to CASCADE so a brand deletion cleans up the specific plan
ALTER TABLE content_plans 
DROP CONSTRAINT IF EXISTS content_plans_brand_id_fkey,
ADD CONSTRAINT content_plans_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES brand_details(id) ON DELETE CASCADE;

-- 4. Fix profiles default_brand_id (SET NULL instead of CASCADE)
-- This column is currently handled in the application layer but we should ensure the DB constraint exists.
-- Note: 'profiles' table exists in the schema.
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'default_brand_id') THEN
    ALTER TABLE profiles ADD COLUMN default_brand_id UUID REFERENCES brand_details(id) ON DELETE SET NULL;
  ELSE
    ALTER TABLE profiles 
    DROP CONSTRAINT IF EXISTS profiles_default_brand_id_fkey,
    ADD CONSTRAINT profiles_default_brand_id_fkey 
    FOREIGN KEY (default_brand_id) REFERENCES brand_details(id) ON DELETE SET NULL;
  END IF;
END $$;
