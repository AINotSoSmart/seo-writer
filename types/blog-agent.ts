export type ArticleStatus =
  | "queued"
  | "researching"
  | "outlining"
  | "writing"
  | "polishing"
  | "completed"
  | "failed"

export type ArticlePhase = "research" | "outline" | "writing" | "polish" | "trigger"

export type BrandVoiceRow = {
  id: string
  user_id: string
  name: string
  style_dna: unknown
  source_url: string | null
  is_default: boolean
  created_at: string
}

export type BrandVoiceInsert = Omit<BrandVoiceRow, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export type BrandVoiceUpdate = Partial<BrandVoiceRow>

export type ArticleRow = {
  id: string
  user_id: string
  voice_id: string | null
  keyword: string
  status: ArticleStatus
  competitor_data: unknown | null
  outline: unknown | null
  current_step_index: number
  raw_content: string
  final_html: string | null
  error_message: string | null
  failed_at_phase: ArticlePhase | null
  created_at: string
  updated_at: string
}

export type ArticleInsert = Omit<ArticleRow, "id" | "created_at" | "updated_at"> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type ArticleUpdate = Partial<ArticleRow>