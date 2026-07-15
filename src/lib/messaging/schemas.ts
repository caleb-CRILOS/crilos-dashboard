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
  },
  required: [],
};
