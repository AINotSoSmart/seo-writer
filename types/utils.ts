import { Database } from "./supabase";

export type modelRow = Database["public"]["Tables"]["models"]["Row"] & {
  isCustom?: boolean;
};
export type sampleRow = Database["public"]["Tables"]["samples"]["Row"];



export type imageRow = Database["public"]["Tables"]["images"]["Row"];

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

