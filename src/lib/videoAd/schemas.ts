// Plain JSON Schema for the finished Video Ad Framework script, passed to
// the Claude Code CLI's --json-schema flag once the model has emitted
// SCRIPT_COMPLETE_SENTINEL.

export const videoAdScriptSchema = {
  type: "object",
  properties: {
    hook: { type: "string", description: "The 0-5 second Dog Whistle hook line." },
    promise: { type: "string", description: "The 5-15 second promise of what they'll learn." },
    valueBombKeyword: {
      type: "string",
      description: "The comment keyword viewers drop to get the free resource.",
    },
    valueBombResource: {
      type: "string",
      description: "The free resource offered in exchange for the comment keyword.",
    },
    credibility: { type: "string", description: "The 20-30 second credibility statement." },
    problem: {
      type: "string",
      description: "The 30-60 second problem-agitation beat, 3-4 pain points.",
    },
    whySolutionsFail: {
      type: "string",
      description: "The 60-105 second beat on why common approaches fail.",
    },
    solutionSteps: {
      type: "string",
      description: "The 105-165 second beat: 3 actionable steps, real value, no fluff.",
    },
    whyItWorks: {
      type: "string",
      description: "The 165-180 second one-sentence mechanism explanation.",
    },
    cta: {
      type: "string",
      description: "The 180-210 second closing call to action reminding about the value bomb.",
    },
    platform: { type: "string", description: "Instagram, TikTok, LinkedIn, YouTube, etc." },
    finalScript: {
      type: "string",
      description:
        "The complete script exactly as delivered, with each of the 9 steps labeled by its timing window.",
    },
  },
  required: [],
};
