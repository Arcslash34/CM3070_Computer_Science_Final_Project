// supabase.js
import { createClient } from "@supabase/supabase-js";

if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
