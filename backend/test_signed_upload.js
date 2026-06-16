import { supabase, FILE_BUCKET } from "./dist-server/server/supabase.js";
import { appConfig } from "./dist-server/server/config.js";
import * as tus from "tus-js-client";
import * as fs from "fs";

async function test() {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUploadUrl("test-tus-file.txt");
  if (error) {
    console.error("Error creating signed URL:", error);
    return;
  }
  
  console.log("Signed URL Token:", data.token);

  fs.writeFileSync("test-tus-file.txt", "Hello World via TUS!");

  const file = fs.createReadStream("test-tus-file.txt");
  
  const upload = new tus.Upload(file, {
    endpoint: `${appConfig.supabaseUrl}/storage/v1/upload/resumable`,
    retryDelays: [0, 3000, 5000],
    headers: {
      authorization: `Bearer ${data.token}`
    },
    metadata: {
      bucketName: FILE_BUCKET,
      objectName: "test-tus-file.txt",
      contentType: "text/plain"
    },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    chunkSize: 6 * 1024 * 1024,
    onError: function(error) {
      console.log("Failed because: " + error);
    },
    onProgress: function(bytesUploaded, bytesTotal) {
      var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2);
      console.log(bytesUploaded, bytesTotal, percentage + "%");
    },
    onSuccess: function() {
      console.log("Download %s from %s", upload.file.name, upload.url);
    }
  });

  upload.start();
}
test();
