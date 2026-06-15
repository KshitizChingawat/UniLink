import { createClient } from "@supabase/supabase-js";
import { appConfig } from "./config.js";
// Service-role client bypasses Row Level Security — only use on the server, never expose to frontend
export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});
// Must match the bucket names created in Supabase Storage
export const FILE_BUCKET = "unilink-files"; // cloud file transfers
export const SESSION_BUCKET = "unilink-sessions"; // real-time session transfers
export const DB_BUCKET = "unilink-db"; // persistent JSON database
export const SECURITY_BUCKET = "unilink-security";
