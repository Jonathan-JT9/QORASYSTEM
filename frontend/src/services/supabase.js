import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey && !String(url).includes("your-project"));

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;

export async function fetchExamHistory() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exam_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function insertExamHistory(row) {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;
  const payload = {
    patient_code: row.patient_code || null,
    filename: row.filename || null,
    predicted_label: row.label,
    probability_tb: row.probabilities?.TB ?? null,
    probability_normal: row.probabilities?.Normal ?? null,
    confidence: row.confidence ?? null,
    interpretation: row.interpretation || null,
    user_id: userId,
  };
  const { data, error } = await supabase.from("exam_history").insert(payload).select().single();
  if (error) throw error;
  return data;
}
