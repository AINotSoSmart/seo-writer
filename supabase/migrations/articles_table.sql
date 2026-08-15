create table public.articles (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  brand_id uuid null,
  keyword text not null,
  status public.article_status null default 'queued'::article_status,
  competitor_data jsonb null,
  outline jsonb null,
  current_step_index integer null default 0,
  raw_content text null default ''::text,
  final_html text null,
  error_message text null,
  failed_at_phase public.article_phase null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  meta_description text null,
  slug text null,
  featured_image_url text null,
  wordpress_post_id text null,
  wordpress_post_url text null,
  wordpress_site_id uuid null,
  published_at timestamp with time zone null,
  webflow_item_id text null,
  webflow_item_url text null,
  webflow_site_id uuid null,
  shopify_article_id text null,
  shopify_article_url text null,
  shopify_connection_id uuid null,
  article_type text null default 'informational'::text,
  topic_embedding extensions.vector null,
  supporting_keywords text[] null,
  constraint articles_pkey primary key (id),
  constraint articles_shopify_connection_id_fkey foreign KEY (shopify_connection_id) references shopify_connections (id),
  constraint articles_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint articles_webflow_site_id_fkey foreign KEY (webflow_site_id) references webflow_connections (id),
  constraint articles_wordpress_site_id_fkey foreign KEY (wordpress_site_id) references wordpress_connections (id)
) TABLESPACE pg_default;

create index IF not exists idx_articles_user on public.articles using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_articles_status on public.articles using btree (status) TABLESPACE pg_default;

create index IF not exists articles_slug_idx on public.articles using btree (slug) TABLESPACE pg_default;

create index IF not exists articles_topic_embedding_idx on public.articles using ivfflat (topic_embedding extensions.vector_cosine_ops)
with
  (lists = '100') TABLESPACE pg_default;

create trigger update_articles_modtime BEFORE
update on articles for EACH row
execute FUNCTION update_updated_at_column ();