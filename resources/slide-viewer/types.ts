import { z } from "zod";

export const slideSchema = z.object({
  title: z.string().describe("Slide title"),
  content: z.string().describe("Slide content as HTML"),
  bgColor: z.string().optional().describe("Background color CSS value"),
  layout: z.enum(["center", "left", "split"]).optional().describe("Slide layout"),
  imageUrl: z.string().optional().describe("URL of an image to display on the slide"),
});

export const propSchema = z.object({
  deckTitle: z.string().optional().describe("Deck title"),
  slides: z.array(slideSchema).describe("Array of slides"),
  theme: z.enum(["light", "dark", "gradient"]).optional().describe("Presentation theme"),
});

export type SlideViewerProps = z.infer<typeof propSchema>;
export type Slide = z.infer<typeof slideSchema>;
