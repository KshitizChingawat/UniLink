import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
      "Add them to your Render environment settings.",
  );
}

// Service-role client bypasses Row Level Security — only use on the server, never expose to frontend
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Must match the bucket names created in Supabase Storage
export const FILE_BUCKET = "unilink-files";      // cloud file transfers
export const SESSION_BUCKET = "unilink-sessions"; // real-time session transfers
export const DB_BUCKET = "unilink-db";            // persistent JSON database
