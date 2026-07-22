// fal.ai FLUX.1 [schnell] background generation for Digital Product covers.
//
// This only ever produces a DECORATIVE background image. The cover's text is
// always rendered by satori (src/lib/covers/renderCover.ts), never by the
// model, so the prompt hard-forbids any text/letters. The coach's own fal.ai
// key (Settings.falApiKey) pays for it; with no key set, this is never called
// and covers stay 100% free. Behind a tiny provider seam so a different
// provider (OpenAI gpt-image, Google Imagen) could swap in later.

const FAL_ENDPOINT = "https://fal.run/fal-ai/flux/schnell";

// Always appended so the model never renders type onto the background.
const NO_TEXT_GUARD =
  "abstract, professional, editorial background texture, soft depth of field, " +
  "muted tasteful palette, no text, no words, no letters, no typography, no logos, no watermark";

export function buildBackgroundPrompt(opts: {
  title?: string;
  productType?: string;
  userPrompt?: string;
}): string {
  const seed =
    opts.userPrompt?.trim() ||
    [opts.productType, opts.title].filter(Boolean).join(" — ") ||
    "a calm, premium brand background for a coaching lead magnet";
  return `${seed}. ${NO_TEXT_GUARD}.`;
}

// Generate a background image and return its raw bytes. Throws with a
// human-readable message on any failure (bad key, rate limit, network).
export async function generateCoverBackground(apiKey: string, prompt: string): Promise<Buffer> {
  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 896, height: 1280 }, // portrait, ~A4; cover crops to fit
      num_images: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fal.ai request failed: ${res.status} ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { images?: { url?: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("fal.ai returned no image.");

  const img = await fetch(url);
  if (!img.ok) throw new Error(`Could not download the generated image: ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}
