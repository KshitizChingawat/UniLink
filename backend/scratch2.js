import { z } from "zod";
const uploadInitSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  fileSize: z.coerce.number().int().nonnegative().max(10737418240),
  fileType: z.string().trim().max(120).optional(),
  senderDeviceId: z.string().trim().min(1),
  receiverDeviceId: z.string().trim().optional(),
  transferMethod: z.enum(["cloud", "p2p", "local"]).default("cloud"),
});
console.log(uploadInitSchema.safeParse({
  fileName: "test",
  fileSize: 1000,
  fileType: "",
  senderDeviceId: "device"
}));
