// Plain JSON Schema for the finished piece, passed to the Claude Code CLI's
// --json-schema flag once the model has emitted PIECE_COMPLETE_SENTINEL.

export const messagingPieceSchema = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description: "A short 3-6 word title for this piece, not a full sentence.",
    },
    format: { type: "string", description: "image, carousel, video, or blog post" },
    platform: { type: "string" },
    cta: { type: "string" },
    finalText: {
      type: "string",
      description: "The complete, final piece of content exactly as delivered to the client.",
    },
    caption: {
      type: "string",
      description:
        "The post caption the client pastes into the platform. For a CAROUSEL this is the post body that accompanies the slides (the slide text itself lives in `slides`, the full 6-beat piece in finalText). For a single IMAGE post it is the full caption, same as finalText. For video, the video description; for a blog post, omit.",
    },
    hashtags: {
      type: "array",
      description:
        "5-10 hashtags suited to the platform, WITHOUT the leading '#'. Omit for blog posts and email.",
      items: { type: "string" },
    },
    hookVariants: {
      type: "array",
      description:
        "2-3 alternate opening lines for this same piece, each a drop-in replacement for the first line of the caption, so the client can A/B test the hook.",
      items: { type: "string" },
    },
    imageConcept: {
      type: "string",
      description:
        "One or two sentences of visual direction for this piece -- mood, subject, and palette. Describes a DECORATIVE background only: no text, letters, or logos, since the on-image copy is rendered separately.",
    },
    suggestedPostAt: {
      type: "string",
      description:
        "A short plain-language recommendation of when to post this, e.g. 'Tuesday morning' or 'this weekend'. Not a date.",
    },
    slides: {
      type: "array",
      description:
        "For CAROUSEL format: the piece broken into ordered slides that match the carousel draft above, one object per slide (final slide is The Cake + CTA). For a single IMAGE post: exactly ONE object holding only the short on-image text -- a punchy hook headline plus a one-line supporting body; the full caption stays in finalText, do NOT put it here. Omit or leave empty for video/blog. Keep each headline to a few words and each body to 1-3 short sentences.",
      items: {
        type: "object",
        properties: {
          headline: {
            type: "string",
            description: "Short slide headline/title, a few words.",
          },
          body: {
            type: "string",
            description: "The slide's body text, 1-3 short sentences.",
          },
        },
      },
    },
    imageCardStyle: {
      type: "string",
      enum: ["hook-cta", "hook-intro", "headline-only"],
      description:
        "Single IMAGE posts ONLY (omit for carousel/video/blog): which on-image text treatment the client chose in the conversation -- 'hook-cta' (headline + CTA), 'hook-intro' (headline + a one-line intro + CTA), or 'headline-only' (just the hook). Default to 'hook-cta' if the client didn't specify.",
    },
  },
  required: [],
};
