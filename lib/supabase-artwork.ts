
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const artworkBucket =
  process.env.SUPABASE_ARTWORK_BUCKET || "customer-artwork";

export const supabaseArtwork =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export function getSupabaseArtwork() {
  if (!supabaseArtwork) {
    throw new Error("SUPABASE_ARTWORK_ENV_MISSING");
  }

  return supabaseArtwork;
}
