import { z } from "zod";

const PRO_FILE_SIZE_LIMIT = Math.max(10 * 1024 * 1024 * 1024, 100 * 1024 * 1024);

const uploadInitSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  fileSize: z.coerce.number().int().nonnegative().max(PRO_FILE_SIZE_LIMIT),
  fileType: z.string().trim().max(120).optional(),
  senderDeviceId: z.string().trim().min(1),
  receiverDeviceId: z.string().trim().optional(),
  transferMethod: z.enum(["cloud", "p2p", "local"]).default("cloud"),
});

const reqBody = {
  fileName: "very_large_file.zip",
  fileSize: 9 * 1024 * 1024 * 1024, // 9 GB
  fileType: "application/zip",
  senderDeviceId: "device123",
  transferMethod: "cloud"
};

const parsed = uploadInitSchema.safeParse(reqBody);
console.log(JSON.stringify(parsed, null, 2));
