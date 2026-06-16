import { supabase, FILE_BUCKET } from "./dist-server/server/supabase.js";

async function test() {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUploadUrl("test-file.txt");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success:", data);
  }
}
test();
