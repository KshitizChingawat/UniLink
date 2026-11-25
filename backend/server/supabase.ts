import { createClient } from "@supabase/supabase-js";
import { appConfig } from "./config.js";

// Service-role client bypasses Row Level Security — only use on the server, never expose to frontend
export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Must match the bucket names created in Supabase Storage
export const FILE_BUCKET = "unilink-files";      // cloud file transfers
export const SESSION_BUCKET = "unilink-sessions"; // real-time session transfers
export const DB_BUCKET = "unilink-db";            // persistent JSON database
export const SECURITY_BUCKET = "unilink-security";

export const verifyProductionStorage = async () => {
  if (!appConfig.isProduction) return;
  for (const name of [DB_BUCKET, FILE_BUCKET, SESSION_BUCKET]) {
    const { data, error } = await supabase.storage.getBucket(name);
    if (error || !data || data.public !== false) {
      throw new Error(`Production requires a private ${name} bucket`);
    }
  }
  const { error, status } = await supabase.from("revoked_tokens").select("jti,reason").limit(0);
  if (!error) return;

  const failure = `Revocation table check failed (HTTP ${status}, ${error.code || "no database error code"})`;
  if (error.code === "PGRST205" || error.code === "42P01") {
    throw new Error(`${failure}. Run backend/revoked_tokens.sql in the Supabase project configured on Render to create the table and refresh the API schema.`);
  }
  if (error.code === "42501") {
    throw new Error(`${failure}. Verify the backend uses the service_role key and apply the grants in backend/revoked_tokens.sql.`);
  }
  if (status === 401 || status === 403) {
    throw new Error(`${failure}. Check the Supabase URL and service-role credential configured on the backend.`);
  }
  throw new Error(`${failure}. Check Supabase Data API availability and the public.revoked_tokens schema.`);
};
