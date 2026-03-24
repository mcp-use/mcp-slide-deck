import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";

const server = new MCPServer({
  name: "slide-deck",
  title: "Slide Deck",
  version: "1.0.0",
  description: "AI-powered presentations — slides in your chat",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  icons: [{ src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] }],
});

const slideSchema = z.object({
  title: z.string().describe("Slide title"),
  content: z.string().describe("Slide content as HTML"),
  bgColor: z.string().optional().describe("Background color CSS value"),
  layout: z.enum(["center", "left", "split"]).optional().describe("Slide layout"),
  imageUrl: z.string().optional().describe("URL of an image to display on the slide"),
});

let currentDeck: {
  title?: string;
  slides: z.infer<typeof slideSchema>[];
  theme?: "light" | "dark" | "gradient";
} | null = null;

// --- Asset storage ---
const assets = new Map<string, { data: string; mimeType: string; name: string }>();

server.post("/api/assets", async (c) => {
  const body = await c.req.json();
  const { name, mimeType, data } = body;
  if (!name || !data) return c.json({ error: "name and data required" }, 400);
  const id = crypto.randomUUID();
  assets.set(id, { data, mimeType: mimeType || "application/octet-stream", name });
  const baseUrl = process.env.MCP_URL || `http://localhost:${server.serverPort || 3000}`;
  return c.json({ id, url: `${baseUrl}/api/assets/${id}` });
});

server.get("/api/assets/:id", async (c) => {
  const id = c.req.param("id");
  const asset = assets.get(id);
  if (!asset) return c.json({ error: "Not found" }, 404);
  const buf = Buffer.from(asset.data, "base64");
  return new Response(buf, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `inline; filename="${asset.name}"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// --- Tools ---

server.tool(
  {
    name: "create-slides",
    description:
      "Create a presentation slide deck. Each slide has a title, HTML content, " +
      "optional background color, layout, and imageUrl. The deck streams progressively into " +
      "a navigable viewer with fullscreen presentation mode.",
    schema: z.object({
      title: z.string().optional().describe("Deck title"),
      slides: z.array(slideSchema).describe("Array of slides"),
      theme: z.enum(["light", "dark", "gradient"]).optional().describe("Presentation theme"),
    }),
    widget: {
      name: "slide-viewer",
      invoking: "Building slides...",
      invoked: "Presentation ready",
    },
  },
  async ({ title, slides, theme }) => {
    currentDeck = { title, slides, theme };
    return widget({
      props: { deckTitle: title, slides, theme },
      output: text(`Created presentation${title ? `: "${title}"` : ""} with ${slides.length} slide${slides.length === 1 ? "" : "s"}`),
    });
  }
);

server.tool(
  {
    name: "edit-slide",
    description: "Edit a single slide in the current deck by index.",
    schema: z.object({
      slideIndex: z.number().describe("0-based index of the slide to edit"),
      title: z.string().optional().describe("New slide title"),
      content: z.string().optional().describe("New slide content as HTML"),
      bgColor: z.string().optional().describe("New background color CSS value"),
      layout: z.enum(["center", "left", "split"]).optional().describe("New slide layout"),
      imageUrl: z.string().optional().describe("URL of an image to display"),
    }),
    widget: {
      name: "slide-viewer",
      invoking: "Updating slide...",
      invoked: "Slide updated",
    },
  },
  async ({ slideIndex, title, content, bgColor, layout, imageUrl }) => {
    if (!currentDeck || slideIndex < 0 || slideIndex >= currentDeck.slides.length) {
      return text(
        `Invalid slide index ${slideIndex}. ${currentDeck ? `Deck has ${currentDeck.slides.length} slides (0-${currentDeck.slides.length - 1}).` : "No deck exists yet — use create-slides first."}`
      );
    }
    const slide = currentDeck.slides[slideIndex];
    if (title !== undefined) slide.title = title;
    if (content !== undefined) slide.content = content;
    if (bgColor !== undefined) slide.bgColor = bgColor;
    if (layout !== undefined) slide.layout = layout;
    if (imageUrl !== undefined) slide.imageUrl = imageUrl;

    return widget({
      props: { deckTitle: currentDeck.title, slides: currentDeck.slides, theme: currentDeck.theme },
      output: text(`Updated slide ${slideIndex + 1}: "${slide.title}"`),
    });
  }
);

server.tool(
  {
    name: "upload-asset",
    description: "Open the asset uploader to add images or files for use in slides. Uploaded assets get a URL you can pass as imageUrl in create-slides or edit-slide.",
    schema: z.object({}),
    widget: {
      name: "asset-uploader",
      invoking: "Opening uploader...",
      invoked: "Uploader ready",
    },
  },
  async () => {
    const assetList = Array.from(assets.entries()).map(([id, a]) => ({
      id,
      name: a.name,
      mimeType: a.mimeType,
      url: `${process.env.MCP_URL || "http://localhost:3000"}/api/assets/${id}`,
    }));
    return widget({
      props: { assets: assetList },
      output: text(`Asset uploader ready. ${assetList.length} asset(s) already uploaded.`),
    });
  }
);

server.tool(
  {
    name: "export-deck",
    description: "Export the current slide deck as a self-contained HTML file that can be downloaded and opened in a browser.",
    schema: z.object({}),
  },
  async () => {
    if (!currentDeck || currentDeck.slides.length === 0) {
      return text("No deck to export. Use create-slides first.");
    }

    const themeCSS: Record<string, string> = {
      light: "background:#fff;color:#1a1a2e;",
      dark: "background:#1a1a2e;color:#fff;",
      gradient: "background:linear-gradient(135deg,#667eea,#764ba2,#f093fb);color:#fff;",
    };
    const theme = currentDeck.theme || "light";

    const slidesHtml = currentDeck.slides.map((s, i) => `
      <div class="slide" style="${s.bgColor ? `background:${s.bgColor};` : ""}">
        <h1>${s.title}</h1>
        ${s.imageUrl ? `<img src="${s.imageUrl}" style="max-width:60%;max-height:40%;border-radius:8px;margin:16px auto;" />` : ""}
        <div class="content">${s.content}</div>
        <div class="num">${i + 1} / ${currentDeck!.slides.length}</div>
      </div>`).join("\n");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${currentDeck.title || "Presentation"}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;${themeCSS[theme] || themeCSS.light}}
.slide{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px;position:relative}
h1{font-size:3rem;margin-bottom:24px}
.content{font-size:1.5rem;max-width:800px;line-height:1.7}
.content ul,.content ol{margin-left:1.5em}
.num{position:absolute;bottom:24px;right:32px;opacity:0.4;font-size:0.9rem}
img{display:block}
@media print{.slide{page-break-after:always}}
</style></head><body>${slidesHtml}</body></html>`;

    const id = crypto.randomUUID();
    assets.set(id, { data: Buffer.from(html).toString("base64"), mimeType: "text/html", name: `${currentDeck.title || "presentation"}.html` });
    const baseUrl = process.env.MCP_URL || "http://localhost:3000";
    return text(`Deck exported as HTML.\nDownload: ${baseUrl}/api/assets/${id}`);
  }
);

server.listen().then(() => console.log("Slide Deck server running"));
