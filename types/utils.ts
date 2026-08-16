import { Database } from "./supabase";

export type creditsRow = Database["public"]["Tables"]["credits"]["Row"];

export type modelRowWithSamples = {
  id: number
  name: string
  type: string
  status: "processing" | "finished" | "failed"
  samples: { uri: string }[]
  created_at: string
  is_custom: boolean
  auto_extend: boolean
}
