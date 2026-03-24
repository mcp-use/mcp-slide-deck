import { z } from "zod";

export const propSchema = z.object({
  assets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string(),
    url: z.string(),
  })).describe("List of uploaded assets"),
});

export type AssetUploaderProps = z.infer<typeof propSchema>;
