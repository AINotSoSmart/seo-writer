export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_probe_prompts: {
        Row: {
          answers_present: number
          answers_total: number
          article_type: string
          created_at: string
          id: string
          intent: string
          mean_mention_position: number | null
          prompt: string
          prompt_norm: string
          run_id: string
          scope_family_id: string
          source_seed: string
          tracked_prompt_id: string | null
          user_id: string
          verdict: string
        }
        Insert: {
          answers_present?: number
          answers_total?: number
          article_type: string
          created_at?: string
          id?: string
          intent: string
          mean_mention_position?: number | null
          prompt: string
          prompt_norm: string
          run_id: string
          scope_family_id: string
          source_seed: string
          tracked_prompt_id?: string | null
          user_id: string
          verdict?: string
        }
        Update: {
          answers_present?: number
          answers_total?: number
          article_type?: string
          created_at?: string
          id?: string
          intent?: string
          mean_mention_position?: number | null
          prompt?: string
          prompt_norm?: string
          run_id?: string
          scope_family_id?: string
          source_seed?: string
          tracked_prompt_id?: string | null
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_probe_prompts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_probe_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_probe_prompts_scope_family_id_fkey"
            columns: ["scope_family_id"]
            isOneToOne: false
            referencedRelation: "audit_scope_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_probe_prompts_tracked_prompt_id_fkey"
            columns: ["tracked_prompt_id"]
            isOneToOne: false
            referencedRelation: "tracked_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_probe_results: {
        Row: {
          answer_text: string
          citation_count: number
          citations: Json
          cloro_task_id: string | null
          competitor_mentions: Json
          credits_used: number
          engine: string
          id: string
          mention_count: number
          mention_position: number | null
          mentioned_entity_count: number
          model: string
          observed_at: string
          prompt_id: string
          run_id: string
          search_queries: Json
          surface: string
          total_citations: number
          user_id: string
        }
        Insert: {
          answer_text: string
          citation_count?: number
          citations?: Json
          cloro_task_id?: string | null
          competitor_mentions?: Json
          credits_used?: number
          engine: string
          id?: string
          mention_count?: number
          mention_position?: number | null
          mentioned_entity_count?: number
          model: string
          observed_at?: string
          prompt_id: string
          run_id: string
          search_queries?: Json
          surface?: string
          total_citations?: number
          user_id: string
        }
        Update: {
          answer_text?: string
          citation_count?: number
          citations?: Json
          cloro_task_id?: string | null
          competitor_mentions?: Json
          credits_used?: number
          engine?: string
          id?: string
          mention_count?: number
          mention_position?: number | null
          mentioned_entity_count?: number
          model?: string
          observed_at?: string
          prompt_id?: string
          run_id?: string
          search_queries?: Json
          surface?: string
          total_citations?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_probe_results_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_probe_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_probe_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_probe_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_probe_runs: {
        Row: {
          answer_count: number
          audit_id: string | null
          brand_id: string
          clusters: Json
          competitors: Json
          completed_at: string | null
          country_code: string | null
          credits_used: number
          duration_ms: number | null
          engine_ledger: Json
          engines: string[]
          failure_reason: string | null
          gap_prompt_count: number
          id: string
          phase: string | null
          phase_detail: string | null
          present_answer_count: number
          prompt_count: number
          public_token: string | null
          started_at: string
          status: string
          subject_domains: string[]
          subject_name: string
          summary: Json
          trigger_run_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_count?: number
          audit_id?: string | null
          brand_id: string
          clusters?: Json
          competitors?: Json
          completed_at?: string | null
          country_code?: string | null
          credits_used?: number
          duration_ms?: number | null
          engine_ledger?: Json
          engines?: string[]
          failure_reason?: string | null
          gap_prompt_count?: number
          id?: string
          phase?: string | null
          phase_detail?: string | null
          present_answer_count?: number
          prompt_count?: number
          public_token?: string | null
          started_at?: string
          status?: string
          subject_domains?: string[]
          subject_name: string
          summary?: Json
          trigger_run_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_count?: number
          audit_id?: string | null
          brand_id?: string
          clusters?: Json
          competitors?: Json
          completed_at?: string | null
          country_code?: string | null
          credits_used?: number
          duration_ms?: number | null
          engine_ledger?: Json
          engines?: string[]
          failure_reason?: string | null
          gap_prompt_count?: number
          id?: string
          phase?: string | null
          phase_detail?: string | null
          present_answer_count?: number
          prompt_count?: number
          public_token?: string | null
          started_at?: string
          status?: string
          subject_domains?: string[]
          subject_name?: string
          summary?: Json
          trigger_run_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_probe_runs_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_probe_runs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_usage: {
        Row: {
          created_at: string
          cycle_start_date: string
          last_request_at: string | null
          tokens_limit: number
          tokens_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_start_date?: string
          last_request_at?: string | null
          tokens_limit?: number
          tokens_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_start_date?: string
          last_request_at?: string | null
          tokens_limit?: number
          tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      answer_coverage: {
        Row: {
          answer_embedding: string | null
          answer_unit: string
          brand_id: string | null
          cluster: string
          coverage_state: string
          first_covered_by: string | null
          id: string
          last_updated_at: string | null
          user_id: string
        }
        Insert: {
          answer_embedding?: string | null
          answer_unit: string
          brand_id?: string | null
          cluster: string
          coverage_state: string
          first_covered_by?: string | null
          id?: string
          last_updated_at?: string | null
          user_id: string
        }
        Update: {
          answer_embedding?: string | null
          answer_unit?: string
          brand_id?: string | null
          cluster?: string
          coverage_state?: string
          first_covered_by?: string | null
          id?: string
          last_updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_coverage_article_fkey"
            columns: ["first_covered_by"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          article_type: string | null
          brand_id: string | null
          competitor_data: Json | null
          created_at: string | null
          current_step_index: number | null
          delivery_visible_at: string | null
          error_message: string | null
          failed_at_phase: Database["public"]["Enums"]["article_phase"] | null
          featured_image_url: string | null
          final_html: string | null
          id: string
          keyword: string
          meta_description: string | null
          outline: Json | null
          planned_article_id: string | null
          published_at: string | null
          raw_content: string | null
          shopify_article_id: string | null
          shopify_article_url: string | null
          shopify_connection_id: string | null
          slug: string | null
          status: Database["public"]["Enums"]["article_status"] | null
          supporting_keywords: string[] | null
          topic_embedding: string | null
          updated_at: string | null
          user_id: string
          webflow_item_id: string | null
          webflow_item_url: string | null
          webflow_site_id: string | null
          wordpress_post_id: string | null
          wordpress_post_url: string | null
          wordpress_site_id: string | null
        }
        Insert: {
          article_type?: string | null
          brand_id?: string | null
          competitor_data?: Json | null
          created_at?: string | null
          current_step_index?: number | null
          delivery_visible_at?: string | null
          error_message?: string | null
          failed_at_phase?: Database["public"]["Enums"]["article_phase"] | null
          featured_image_url?: string | null
          final_html?: string | null
          id?: string
          keyword: string
          meta_description?: string | null
          outline?: Json | null
          planned_article_id?: string | null
          published_at?: string | null
          raw_content?: string | null
          shopify_article_id?: string | null
          shopify_article_url?: string | null
          shopify_connection_id?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["article_status"] | null
          supporting_keywords?: string[] | null
          topic_embedding?: string | null
          updated_at?: string | null
          user_id: string
          webflow_item_id?: string | null
          webflow_item_url?: string | null
          webflow_site_id?: string | null
          wordpress_post_id?: string | null
          wordpress_post_url?: string | null
          wordpress_site_id?: string | null
        }
        Update: {
          article_type?: string | null
          brand_id?: string | null
          competitor_data?: Json | null
          created_at?: string | null
          current_step_index?: number | null
          delivery_visible_at?: string | null
          error_message?: string | null
          failed_at_phase?: Database["public"]["Enums"]["article_phase"] | null
          featured_image_url?: string | null
          final_html?: string | null
          id?: string
          keyword?: string
          meta_description?: string | null
          outline?: Json | null
          planned_article_id?: string | null
          published_at?: string | null
          raw_content?: string | null
          shopify_article_id?: string | null
          shopify_article_url?: string | null
          shopify_connection_id?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["article_status"] | null
          supporting_keywords?: string[] | null
          topic_embedding?: string | null
          updated_at?: string | null
          user_id?: string
          webflow_item_id?: string | null
          webflow_item_url?: string | null
          webflow_site_id?: string | null
          wordpress_post_id?: string | null
          wordpress_post_url?: string | null
          wordpress_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_planned_article_id_fkey"
            columns: ["planned_article_id"]
            isOneToOne: false
            referencedRelation: "planned_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_wordpress_site_id_fkey"
            columns: ["wordpress_site_id"]
            isOneToOne: false
            referencedRelation: "wordpress_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_claims: {
        Row: {
          audit_id: string
          claim_email_normalized: string
          claim_token_hash: string
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
        }
        Insert: {
          audit_id: string
          claim_email_normalized: string
          claim_token_hash: string
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
        }
        Update: {
          audit_id?: string
          claim_email_normalized?: string
          claim_token_hash?: string
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_claims_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: true
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_clusters: {
        Row: {
          article_count: number
          audit_id: string
          brand_id: string | null
          competitor_urls: Json
          created_at: string
          description: string | null
          id: string
          name: string
          priority: number
          scope_family_id: string
          user_id: string
        }
        Insert: {
          article_count?: number
          audit_id: string
          brand_id?: string | null
          competitor_urls?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: number
          scope_family_id: string
          user_id: string
        }
        Update: {
          article_count?: number
          audit_id?: string
          brand_id?: string | null
          competitor_urls?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: number
          scope_family_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_clusters_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_clusters_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_clusters_scope_family_fkey"
            columns: ["scope_family_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "audit_scope_families"
            referencedColumns: ["id", "audit_id"]
          },
        ]
      }
      audit_scope_families: {
        Row: {
          audit_id: string
          brand_scope_family_id: string | null
          capability_contract: Json | null
          created_at: string
          description: string
          evidence: Json
          id: string
          name: string
          parent_scope_family_id: string | null
          priority: number
          seed_keywords: string[]
          source: string
          user_id: string
        }
        Insert: {
          audit_id: string
          brand_scope_family_id?: string | null
          capability_contract?: Json | null
          created_at?: string
          description: string
          evidence?: Json
          id?: string
          name: string
          parent_scope_family_id?: string | null
          priority: number
          seed_keywords: string[]
          source: string
          user_id: string
        }
        Update: {
          audit_id?: string
          brand_scope_family_id?: string | null
          capability_contract?: Json | null
          created_at?: string
          description?: string
          evidence?: Json
          id?: string
          name?: string
          parent_scope_family_id?: string | null
          priority?: number
          seed_keywords?: string[]
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_scope_families_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_scope_families_brand_scope_family_id_fkey"
            columns: ["brand_scope_family_id"]
            isOneToOne: false
            referencedRelation: "brand_scope_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_scope_family_parent_fkey"
            columns: ["parent_scope_family_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "audit_scope_families"
            referencedColumns: ["id", "audit_id"]
          },
        ]
      }
      brand_analyze_corpus: {
        Row: {
          host: string
          pages: Json
          ready_at: string | null
          started_at: string
          status: string
          tavily_started_at: string | null
          user_id: string
        }
        Insert: {
          host: string
          pages?: Json
          ready_at?: string | null
          started_at?: string
          status?: string
          tavily_started_at?: string | null
          user_id: string
        }
        Update: {
          host?: string
          pages?: Json
          ready_at?: string | null
          started_at?: string
          status?: string
          tavily_started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brand_details: {
        Row: {
          brand_data: Json
          created_at: string | null
          current_audit_id: string | null
          deleted_at: string | null
          discovered_competitors: Json | null
          id: string
          image_style: string | null
          pillar_recommendations: Json | null
          scope_confirmed_at: string | null
          scope_contract_version: string | null
          scope_hash: string | null
          updated_at: string | null
          user_id: string
          website_url: string
        }
        Insert: {
          brand_data?: Json
          created_at?: string | null
          current_audit_id?: string | null
          deleted_at?: string | null
          discovered_competitors?: Json | null
          id?: string
          image_style?: string | null
          pillar_recommendations?: Json | null
          scope_confirmed_at?: string | null
          scope_contract_version?: string | null
          scope_hash?: string | null
          updated_at?: string | null
          user_id: string
          website_url: string
        }
        Update: {
          brand_data?: Json
          created_at?: string | null
          current_audit_id?: string | null
          deleted_at?: string | null
          discovered_competitors?: Json | null
          id?: string
          image_style?: string | null
          pillar_recommendations?: Json | null
          scope_confirmed_at?: string | null
          scope_contract_version?: string | null
          scope_hash?: string | null
          updated_at?: string | null
          user_id?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_details_current_audit_id_fkey"
            columns: ["current_audit_id"]
            isOneToOne: false
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_scope_families: {
        Row: {
          brand_id: string
          capability_contract: Json | null
          created_at: string
          description: string
          enabled: boolean
          evidence: Json
          id: string
          name: string
          parent_scope_family_id: string | null
          priority: number
          seed_keywords: string[]
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          capability_contract?: Json | null
          created_at?: string
          description: string
          enabled?: boolean
          evidence?: Json
          id?: string
          name: string
          parent_scope_family_id?: string | null
          priority: number
          seed_keywords: string[]
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          capability_contract?: Json | null
          created_at?: string
          description?: string
          enabled?: boolean
          evidence?: Json
          id?: string
          name?: string
          parent_scope_family_id?: string | null
          priority?: number
          seed_keywords?: string[]
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_scope_families_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_scope_family_parent_fkey"
            columns: ["parent_scope_family_id"]
            isOneToOne: false
            referencedRelation: "brand_scope_families"
            referencedColumns: ["id"]
          },
        ]
      }
      content_opportunities: {
        Row: {
          brand_id: string
          created_at: string
          first_seen_run_id: string | null
          id: string
          last_priority: number | null
          last_reason: string | null
          last_seen_run_id: string | null
          last_verdict: string | null
          resolution_type: string
          resolved_at: string | null
          state: string
          target_url: string | null
          tracked_prompt_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          first_seen_run_id?: string | null
          id?: string
          last_priority?: number | null
          last_reason?: string | null
          last_seen_run_id?: string | null
          last_verdict?: string | null
          resolution_type?: string
          resolved_at?: string | null
          state?: string
          target_url?: string | null
          tracked_prompt_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          first_seen_run_id?: string | null
          id?: string
          last_priority?: number | null
          last_reason?: string | null
          last_seen_run_id?: string | null
          last_verdict?: string | null
          resolution_type?: string
          resolved_at?: string | null
          state?: string
          target_url?: string | null
          tracked_prompt_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_opportunities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_opportunities_first_seen_run_id_fkey"
            columns: ["first_seen_run_id"]
            isOneToOne: false
            referencedRelation: "ai_probe_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_opportunities_last_seen_run_id_fkey"
            columns: ["last_seen_run_id"]
            isOneToOne: false
            referencedRelation: "ai_probe_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_opportunities_tracked_prompt_id_fkey"
            columns: ["tracked_prompt_id"]
            isOneToOne: false
            referencedRelation: "tracked_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          created_at: string
          credits: number
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      cycle_action_opportunities: {
        Row: {
          brand_id: string
          created_at: string
          cycle_action_id: string
          cycle_id: string
          id: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          cycle_action_id: string
          cycle_id: string
          id?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          cycle_action_id?: string
          cycle_id?: string
          id?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_action_opportunities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_action_opportunities_cycle_action_id_fkey"
            columns: ["cycle_action_id"]
            isOneToOne: false
            referencedRelation: "cycle_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_action_opportunities_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_action_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "content_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_actions: {
        Row: {
          assisted_by_user_id: string | null
          assisted_completed_at: string | null
          brand_id: string
          created_at: string
          cycle_id: string
          delivered_at: string | null
          failure_code: string | null
          generation_started_at: string | null
          id: string
          rank: number
          ready_at: string | null
          resolution_type: string
          retry_count: number
          selection_reason: string
          state: string
          target_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assisted_by_user_id?: string | null
          assisted_completed_at?: string | null
          brand_id: string
          created_at?: string
          cycle_id: string
          delivered_at?: string | null
          failure_code?: string | null
          generation_started_at?: string | null
          id?: string
          rank: number
          ready_at?: string | null
          resolution_type: string
          retry_count?: number
          selection_reason: string
          state?: string
          target_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assisted_by_user_id?: string | null
          assisted_completed_at?: string | null
          brand_id?: string
          created_at?: string
          cycle_id?: string
          delivered_at?: string | null
          failure_code?: string | null
          generation_started_at?: string | null
          id?: string
          rank?: number
          ready_at?: string | null
          resolution_type?: string
          retry_count?: number
          selection_reason?: string
          state?: string
          target_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_actions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_actions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      dodo_payments: {
        Row: {
          amount: number
          created_at: string
          credits: number
          currency: string
          dodo_checkout_session_id: string | null
          dodo_payment_id: string
          id: string
          metadata: Json | null
          pricing_plan_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credits?: number
          currency?: string
          dodo_checkout_session_id?: string | null
          dodo_payment_id: string
          id?: string
          metadata?: Json | null
          pricing_plan_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          currency?: string
          dodo_checkout_session_id?: string | null
          dodo_payment_id?: string
          id?: string
          metadata?: Json | null
          pricing_plan_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dodo_payments_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "dodo_pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dodo_pricing_plans: {
        Row: {
          created_at: string
          credits: number
          currency: string
          description: string | null
          dodo_product_id: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          plan_code: string | null
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          currency?: string
          description?: string | null
          dodo_product_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          plan_code?: string | null
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          currency?: string
          description?: string | null
          dodo_product_id?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          plan_code?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      dodo_subscription_changes: {
        Row: {
          change_type: string
          checkout_session_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          from_plan_id: string | null
          id: string
          metadata: Json | null
          reason: string | null
          status: string
          to_plan_id: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          checkout_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          from_plan_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          status: string
          to_plan_id?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          checkout_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          from_plan_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          status?: string
          to_plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dodo_subscription_changes_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "dodo_pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dodo_subscription_changes_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "dodo_pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dodo_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency_snapshot: string | null
          current_period_end: string | null
          dodo_subscription_id: string | null
          id: string
          metadata: Json | null
          next_billing_date: string | null
          price_snapshot: number | null
          pricing_plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency_snapshot?: string | null
          current_period_end?: string | null
          dodo_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          next_billing_date?: string | null
          price_snapshot?: number | null
          pricing_plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency_snapshot?: string | null
          current_period_end?: string | null
          dodo_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          next_billing_date?: string | null
          price_snapshot?: number | null
          pricing_plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dodo_subscriptions_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "dodo_pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dodo_webhook_events: {
        Row: {
          created_at: string
          data: Json
          dodo_event_id: string
          error_message: string | null
          event_type: string
          id: string
          processed: boolean
          processed_at: string | null
          retry_count: number
        }
        Insert: {
          created_at?: string
          data: Json
          dodo_event_id: string
          error_message?: string | null
          event_type: string
          id?: string
          processed?: boolean
          processed_at?: string | null
          retry_count?: number
        }
        Update: {
          created_at?: string
          data?: Json
          dodo_event_id?: string
          error_message?: string | null
          event_type?: string
          id?: string
          processed?: boolean
          processed_at?: string | null
          retry_count?: number
        }
        Relationships: []
      }
      internal_links: {
        Row: {
          brand_id: string | null
          created_at: string | null
          embedding: string | null
          id: string
          title: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          title: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_links_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_article_links: {
        Row: {
          anchor_text: string
          created_at: string
          cycle_id: string | null
          graph_version: string
          id: string
          program_id: string
          relationship: string
          source_article_id: string
          target_article_id: string | null
          target_url: string
        }
        Insert: {
          anchor_text: string
          created_at?: string
          cycle_id?: string | null
          graph_version?: string
          id?: string
          program_id: string
          relationship: string
          source_article_id: string
          target_article_id?: string | null
          target_url: string
        }
        Update: {
          anchor_text?: string
          created_at?: string
          cycle_id?: string | null
          graph_version?: string
          id?: string
          program_id?: string
          relationship?: string
          source_article_id?: string
          target_article_id?: string | null
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_article_links_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_article_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_article_links_source_article_id_fkey"
            columns: ["source_article_id"]
            isOneToOne: false
            referencedRelation: "planned_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_article_links_target_article_id_fkey"
            columns: ["target_article_id"]
            isOneToOne: false
            referencedRelation: "planned_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_articles: {
        Row: {
          article_contract: Json | null
          article_id: string | null
          article_type: string
          audit_id: string
          brand_id: string | null
          cluster_id: string | null
          contract_version: string | null
          created_at: string
          cycle_action_id: string | null
          delivered_at: string | null
          delivery_status: string
          generated_at: string | null
          generation_error: string | null
          generation_status: string
          id: string
          intent_role: string | null
          is_pillar: boolean
          main_keyword: string
          origin_scope_family_id: string | null
          publication_status: string
          publication_url: string | null
          published_at: string | null
          record_kind: string
          retry_count: number
          scheduled_date: string | null
          scope_family_id: string
          shipped_at: string | null
          slug: string | null
          source_query_ids: string[]
          status: string
          sub_node_intents: string[]
          sub_node_query_ids: string[]
          supporting_keywords: string[]
          target_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          article_contract?: Json | null
          article_id?: string | null
          article_type?: string
          audit_id: string
          brand_id?: string | null
          cluster_id?: string | null
          contract_version?: string | null
          created_at?: string
          cycle_action_id?: string | null
          delivered_at?: string | null
          delivery_status?: string
          generated_at?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          intent_role?: string | null
          is_pillar?: boolean
          main_keyword: string
          origin_scope_family_id?: string | null
          publication_status?: string
          publication_url?: string | null
          published_at?: string | null
          record_kind?: string
          retry_count?: number
          scheduled_date?: string | null
          scope_family_id: string
          shipped_at?: string | null
          slug?: string | null
          source_query_ids?: string[]
          status?: string
          sub_node_intents?: string[]
          sub_node_query_ids?: string[]
          supporting_keywords?: string[]
          target_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          article_contract?: Json | null
          article_id?: string | null
          article_type?: string
          audit_id?: string
          brand_id?: string | null
          cluster_id?: string | null
          contract_version?: string | null
          created_at?: string
          cycle_action_id?: string | null
          delivered_at?: string | null
          delivery_status?: string
          generated_at?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          intent_role?: string | null
          is_pillar?: boolean
          main_keyword?: string
          origin_scope_family_id?: string | null
          publication_status?: string
          publication_url?: string | null
          published_at?: string | null
          record_kind?: string
          retry_count?: number
          scheduled_date?: string | null
          scope_family_id?: string
          shipped_at?: string | null
          slug?: string | null
          source_query_ids?: string[]
          status?: string
          sub_node_intents?: string[]
          sub_node_query_ids?: string[]
          supporting_keywords?: string[]
          target_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_articles_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_articles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "audit_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_articles_cluster_scope_fkey"
            columns: ["cluster_id", "audit_id", "scope_family_id"]
            isOneToOne: false
            referencedRelation: "audit_clusters"
            referencedColumns: ["id", "audit_id", "scope_family_id"]
          },
          {
            foreignKeyName: "planned_articles_cycle_action_id_fkey"
            columns: ["cycle_action_id"]
            isOneToOne: false
            referencedRelation: "cycle_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_articles_scope_family_fkey"
            columns: ["scope_family_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "audit_scope_families"
            referencedColumns: ["id", "audit_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          credits_remaining: number | null
          default_brand_id: string | null
          email: string | null
          id: string
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credits_remaining?: number | null
          default_brand_id?: string | null
          email?: string | null
          id: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credits_remaining?: number | null
          default_brand_id?: string | null
          email?: string | null
          id?: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_brand_id_fkey"
            columns: ["default_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
        ]
      }
      program_cost_events: {
        Row: {
          article_id: string | null
          cost_usd: number | null
          created_at: string
          cycle_action_id: string | null
          cycle_id: string | null
          id: string
          input_units: number
          model: string
          operation: string
          output_units: number
          planned_article_id: string
          pricing_source: string
          program_id: string
          provider: string
          request_count: number
          usage_complete: boolean
        }
        Insert: {
          article_id?: string | null
          cost_usd?: number | null
          created_at?: string
          cycle_action_id?: string | null
          cycle_id?: string | null
          id?: string
          input_units?: number
          model: string
          operation: string
          output_units?: number
          planned_article_id: string
          pricing_source: string
          program_id: string
          provider: string
          request_count?: number
          usage_complete?: boolean
        }
        Update: {
          article_id?: string | null
          cost_usd?: number | null
          created_at?: string
          cycle_action_id?: string | null
          cycle_id?: string | null
          id?: string
          input_units?: number
          model?: string
          operation?: string
          output_units?: number
          planned_article_id?: string
          pricing_source?: string
          program_id?: string
          provider?: string
          request_count?: number
          usage_complete?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "program_cost_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_cost_events_cycle_action_id_fkey"
            columns: ["cycle_action_id"]
            isOneToOne: false
            referencedRelation: "cycle_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_cost_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_cost_events_planned_article_id_fkey"
            columns: ["planned_article_id"]
            isOneToOne: false
            referencedRelation: "planned_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_cost_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          action_allowance: number
          brand_id: string
          cancellation_confirmed_at: string | null
          cancellation_error: string | null
          cancellation_requested_at: string | null
          cancellation_status: string
          completed_at: string | null
          dodo_subscription_id: string | null
          id: string
          paused_at: string | null
          plan_id: string
          publication_url_pattern: string | null
          started_at: string
          status: string
          tracked_prompt_allowance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action_allowance?: number
          brand_id: string
          cancellation_confirmed_at?: string | null
          cancellation_error?: string | null
          cancellation_requested_at?: string | null
          cancellation_status?: string
          completed_at?: string | null
          dodo_subscription_id?: string | null
          id?: string
          paused_at?: string | null
          plan_id?: string
          publication_url_pattern?: string | null
          started_at?: string
          status?: string
          tracked_prompt_allowance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action_allowance?: number
          brand_id?: string
          cancellation_confirmed_at?: string | null
          cancellation_error?: string | null
          cancellation_requested_at?: string | null
          cancellation_status?: string
          completed_at?: string | null
          dodo_subscription_id?: string | null
          id?: string
          paused_at?: string | null
          plan_id?: string
          publication_url_pattern?: string | null
          started_at?: string
          status?: string
          tracked_prompt_allowance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
        ]
      }
      query_pool: {
        Row: {
          audit_id: string
          brand_id: string | null
          competitor_matches: Json
          coverage_similarity: number | null
          covered_by_title: string | null
          covered_by_url: string | null
          embedding: string | null
          first_seen_at: string
          id: string
          intent_binding: Json | null
          last_seen_at: string
          observed_at: string
          observed_value: string
          query: string
          query_norm: string
          scope_family_id: string
          source: string
          source_context: string | null
          source_seed: string | null
          source_url: string
          status: string
          user_id: string
        }
        Insert: {
          audit_id: string
          brand_id?: string | null
          competitor_matches?: Json
          coverage_similarity?: number | null
          covered_by_title?: string | null
          covered_by_url?: string | null
          embedding?: string | null
          first_seen_at?: string
          id?: string
          intent_binding?: Json | null
          last_seen_at?: string
          observed_at?: string
          observed_value: string
          query: string
          query_norm: string
          scope_family_id: string
          source: string
          source_context?: string | null
          source_seed?: string | null
          source_url: string
          status?: string
          user_id: string
        }
        Update: {
          audit_id?: string
          brand_id?: string | null
          competitor_matches?: Json
          coverage_similarity?: number | null
          covered_by_title?: string | null
          covered_by_url?: string | null
          embedding?: string | null
          first_seen_at?: string
          id?: string
          intent_binding?: Json | null
          last_seen_at?: string
          observed_at?: string
          observed_value?: string
          query?: string
          query_norm?: string
          scope_family_id?: string
          source?: string
          source_context?: string | null
          source_seed?: string | null
          source_url?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_pool_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "topical_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_pool_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_pool_scope_family_fkey"
            columns: ["scope_family_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "audit_scope_families"
            referencedColumns: ["id", "audit_id"]
          },
        ]
      }
      subscription_cycles: {
        Row: {
          action_allowance: number
          backlog_action_groups: number | null
          billing_grant_id: string | null
          brand_id: string
          created_at: string
          delivered_at: string | null
          eligible_action_groups: number | null
          failure_code: string | null
          frozen_publication_url_pattern: string | null
          id: string
          measurement_run_id: string | null
          period_end: string
          period_start: string
          program_id: string
          selection_completed_at: string | null
          selection_policy_version: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_allowance?: number
          backlog_action_groups?: number | null
          billing_grant_id?: string | null
          brand_id: string
          created_at?: string
          delivered_at?: string | null
          eligible_action_groups?: number | null
          failure_code?: string | null
          frozen_publication_url_pattern?: string | null
          id?: string
          measurement_run_id?: string | null
          period_end: string
          period_start: string
          program_id: string
          selection_completed_at?: string | null
          selection_policy_version?: string | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_allowance?: number
          backlog_action_groups?: number | null
          billing_grant_id?: string | null
          brand_id?: string
          created_at?: string
          delivered_at?: string | null
          eligible_action_groups?: number | null
          failure_code?: string | null
          frozen_publication_url_pattern?: string | null
          id?: string
          measurement_run_id?: string | null
          period_end?: string
          period_start?: string
          program_id?: string
          selection_completed_at?: string | null
          selection_policy_version?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cycles_billing_grant_id_fkey"
            columns: ["billing_grant_id"]
            isOneToOne: false
            referencedRelation: "subscription_period_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_measurement_run_id_fkey"
            columns: ["measurement_run_id"]
            isOneToOne: false
            referencedRelation: "ai_probe_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_period_grants: {
        Row: {
          allowance: number
          created_at: string
          dodo_subscription_id: string
          id: string
          period_end: string | null
          period_start: string
          program_id: string | null
          source_event_id: string | null
          user_id: string
        }
        Insert: {
          allowance: number
          created_at?: string
          dodo_subscription_id: string
          id?: string
          period_end?: string | null
          period_start: string
          program_id?: string | null
          source_event_id?: string | null
          user_id: string
        }
        Update: {
          allowance?: number
          created_at?: string
          dodo_subscription_id?: string
          id?: string
          period_end?: string | null
          period_start?: string
          program_id?: string | null
          source_event_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_period_grants_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      topical_audits: {
        Row: {
          article_count: number
          audit_kind: string
          authority_score: number
          brand_id: string | null
          brand_snapshot: Json
          cluster_count: number
          competitors_scanned: number
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          failed_at: string | null
          failure_code: string | null
          generation_error: string | null
          generation_phase: string | null
          generation_status: string | null
          harvest_policy_version: string
          id: string
          input_competitors: string[]
          input_seeds: string[]
          pool_size: number
          public_token: string | null
          public_token_revoked_at: string | null
          requires_reaudit: boolean
          result_hash: string | null
          run_status: string
          scope_contract_version: string | null
          scope_hash: string | null
          site_page_snapshot: Json
          source_call_ledger: Json
          started_at: string
          subject_url: string | null
          topics_analyzed: number
          updated_at: string
          user_id: string
          user_pages_scanned: number | null
        }
        Insert: {
          article_count?: number
          audit_kind?: string
          authority_score?: number
          brand_id?: string | null
          brand_snapshot?: Json
          cluster_count?: number
          competitors_scanned?: number
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          failed_at?: string | null
          failure_code?: string | null
          generation_error?: string | null
          generation_phase?: string | null
          generation_status?: string | null
          harvest_policy_version?: string
          id?: string
          input_competitors?: string[]
          input_seeds?: string[]
          pool_size?: number
          public_token?: string | null
          public_token_revoked_at?: string | null
          requires_reaudit?: boolean
          result_hash?: string | null
          run_status?: string
          scope_contract_version?: string | null
          scope_hash?: string | null
          site_page_snapshot?: Json
          source_call_ledger?: Json
          started_at?: string
          subject_url?: string | null
          topics_analyzed?: number
          updated_at?: string
          user_id: string
          user_pages_scanned?: number | null
        }
        Update: {
          article_count?: number
          audit_kind?: string
          authority_score?: number
          brand_id?: string | null
          brand_snapshot?: Json
          cluster_count?: number
          competitors_scanned?: number
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          failed_at?: string | null
          failure_code?: string | null
          generation_error?: string | null
          generation_phase?: string | null
          generation_status?: string | null
          harvest_policy_version?: string
          id?: string
          input_competitors?: string[]
          input_seeds?: string[]
          pool_size?: number
          public_token?: string | null
          public_token_revoked_at?: string | null
          requires_reaudit?: boolean
          result_hash?: string | null
          run_status?: string
          scope_contract_version?: string | null
          scope_hash?: string | null
          site_page_snapshot?: Json
          source_call_ledger?: Json
          started_at?: string
          subject_url?: string | null
          topics_analyzed?: number
          updated_at?: string
          user_id?: string
          user_pages_scanned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topical_audits_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_prompts: {
        Row: {
          article_type: string
          brand_id: string
          coverage_state: string
          created_at: string
          id: string
          intent: string
          position: number
          prompt: string
          prompt_norm: string
          retired_at: string | null
          scope_family_id: string
          source_seed: string
          target_url: string | null
          tracking_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          article_type: string
          brand_id: string
          coverage_state?: string
          created_at?: string
          id?: string
          intent: string
          position: number
          prompt: string
          prompt_norm: string
          retired_at?: string | null
          scope_family_id: string
          source_seed: string
          target_url?: string | null
          tracking_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          article_type?: string
          brand_id?: string
          coverage_state?: string
          created_at?: string
          id?: string
          intent?: string
          position?: number
          prompt?: string
          prompt_norm?: string
          retired_at?: string | null
          scope_family_id?: string
          source_seed?: string
          target_url?: string | null
          tracking_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_prompts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_prompts_scope_family_fkey"
            columns: ["scope_family_id"]
            isOneToOne: false
            referencedRelation: "brand_scope_families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          feedback_text: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      wordpress_connections: {
        Row: {
          app_password: string
          created_at: string | null
          default_category_id: number | null
          id: string
          is_default: boolean | null
          site_name: string | null
          site_url: string
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          app_password: string
          created_at?: string | null
          default_category_id?: number | null
          id?: string
          is_default?: boolean | null
          site_name?: string | null
          site_url: string
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          app_password?: string
          created_at?: string | null
          default_category_id?: number | null
          id?: string
          is_default?: boolean | null
          site_name?: string | null
          site_url?: string
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_harvest_schema_ready: { Args: never; Returns: undefined }
      audit_discard_in_progress: {
        Args: { p_audit_id: string }
        Returns: boolean
      }
      claim_cycle_action: {
        Args: { p_cycle_action_id: string }
        Returns: {
          planned_article_id: string
          retry_count: number
        }[]
      }
      claim_prospect_audit: {
        Args: { p_claim_token_hash: string }
        Returns: {
          audit_id: string
          brand_id: string
        }[]
      }
      complete_founder_assisted_refresh: {
        Args: {
          p_actor_user_id: string
          p_cycle_action_id: string
          p_html: string
          p_markdown: string
        }
        Returns: string
      }
      confirm_brand_scope: {
        Args: {
          p_brand_data: Json
          p_brand_id: string
          p_contract_version: string
          p_families: Json
          p_scope_hash: string
        }
        Returns: undefined
      }
      confirm_tracked_prompts: {
        Args: { p_brand_id: string; p_prompts: Json }
        Returns: number
      }
      consume_ai_tokens: { Args: never; Returns: Json }
      create_customer_audit_with_scope: {
        Args: {
          p_brand_id: string
          p_policy_version: string
          p_public_token: string
          p_user_id: string
        }
        Returns: string
      }
      create_prospect_audit: {
        Args: {
          p_brand_snapshot: Json
          p_claim_email_normalized: string
          p_claim_token_hash: string
          p_creator_user_id: string
          p_input_competitors: string[]
          p_input_seeds: string[]
          p_policy_version: string
          p_public_token: string
          p_subject_url: string
        }
        Returns: string
      }
      create_scoped_prospect_audit: {
        Args: {
          p_brand_snapshot: Json
          p_claim_email_normalized: string
          p_claim_token_hash: string
          p_creator_user_id: string
          p_input_competitors: string[]
          p_input_seeds: string[]
          p_policy_version: string
          p_public_token: string
          p_scope_contract_version: string
          p_scope_families: Json
          p_scope_hash: string
          p_subject_url: string
        }
        Returns: string
      }
      deliver_subscription_cycle: {
        Args: { p_cycle_id: string }
        Returns: boolean
      }
      discard_unpurchased_audit: { Args: { p_audit_id: string }; Returns: Json }
      ensure_recurring_program: {
        Args: {
          p_brand_id: string
          p_dodo_subscription_id: string
          p_publication_url_pattern?: string
          p_user_id: string
        }
        Returns: string
      }
      finalize_audit_run: {
        Args: {
          p_article_rows: Json
          p_audit_id: string
          p_cluster_rows: Json
          p_policy_version: string
          p_query_rows: Json
          p_result_hash: string
          p_source_call_ledger?: Json
          p_statistics: Json
        }
        Returns: undefined
      }
      find_covered_answer: {
        Args: {
          brand_uuid: string
          check_embedding: string
          match_threshold: number
        }
        Returns: {
          answer_text: string
          article_id: string
          similarity: number
        }[]
      }
      find_live_url_from_article: {
        Args: {
          brand_uuid: string
          match_threshold: number
          target_article_id: string
        }
        Returns: {
          live_title: string
          live_url: string
          similarity: number
        }[]
      }
      grant_subscription_period: {
        Args: {
          p_dodo_subscription_id: string
          p_period_end: string
          p_period_start: string
          p_program_id: string
          p_source_event_id: string
          p_user_id: string
        }
        Returns: string
      }
      match_articles: {
        Args: {
          match_count: number
          match_threshold: number
          p_brand_id?: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          id: string
          keyword: string
          similarity: number
        }[]
      }
      match_articles_topic: {
        Args: {
          match_count: number
          match_threshold: number
          p_brand_id?: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          id: string
          keyword: string
          similarity: number
        }[]
      }
      match_internal_links:
        | {
            Args: {
              match_count: number
              match_threshold: number
              p_brand_id: string
              p_user_id: string
              query_embedding: string
            }
            Returns: {
              id: string
              similarity: number
              title: string
              url: string
            }[]
          }
        | {
            Args: {
              match_count: number
              match_threshold: number
              p_user_id: string
              query_embedding: string
            }
            Returns: {
              id: string
              similarity: number
              title: string
              url: string
            }[]
          }
      match_query_pool: {
        Args: {
          match_count: number
          match_threshold: number
          p_brand_id: string
          query_embedding: string
        }
        Returns: {
          id: string
          query: string
          similarity: number
          source_url: string
        }[]
      }
      normalize_tracked_prompt: { Args: { p_text: string }; Returns: string }
      pause_program: { Args: { p_program_id: string }; Returns: undefined }
      purge_brand: {
        Args: {
          p_acknowledge_active_subscription?: boolean
          p_brand_id: string
        }
        Returns: Json
      }
      reconcile_content_opportunities: {
        Args: { p_findings: Json; p_run_id: string }
        Returns: Json
      }
      record_ai_usage: { Args: { p_tokens_used: number }; Returns: Json }
      release_subscription_cycle_if_ready: {
        Args: { p_cycle_id: string }
        Returns: boolean
      }
      resume_program: { Args: { p_program_id: string }; Returns: undefined }
      save_onboarding_brand_with_scope: {
        Args: {
          p_brand_data: Json
          p_brand_id: string
          p_contract_version: string
          p_discovered_competitors: Json
          p_families: Json
          p_scope_hash: string
          p_website_url: string
        }
        Returns: string
      }
      select_subscription_cycle_actions: {
        Args: { p_cycle_id: string; p_publication_url_pattern: string }
        Returns: Json
      }
      slugify_cycle_output: { Args: { p_value: string }; Returns: string }
      triage_content_opportunity_target: {
        Args: {
          p_coverage_state: string
          p_target_url?: string
          p_tracked_prompt_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      article_phase: "research" | "outline" | "writing" | "polish" | "trigger"
      article_status:
        | "queued"
        | "researching"
        | "outlining"
        | "writing"
        | "polishing"
        | "completed"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      article_phase: ["research", "outline", "writing", "polish", "trigger"],
      article_status: [
        "queued",
        "researching",
        "outlining",
        "writing",
        "polishing",
        "completed",
        "failed",
      ],
    },
  },
} as const
