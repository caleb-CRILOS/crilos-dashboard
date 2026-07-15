// Plain JSON Schema for the finished post, passed to the Claude Code CLI's
// --json-schema flag once the model has emitted POST_COMPLETE_SENTINEL.

export const skoolPostSchema = {
  type: "object",
  properties: {
    mode: {
      type: "string",
      description:
        "Which of the 10 formats this is, e.g. 'Celebration', 'Monday goal post', 'Hot-take', '3-version launch'.",
    },
    finalText: {
      type: "string",
      description:
        "The complete, final post exactly as delivered to the client. For the 3-version launch format, include all three labeled versions in this one string.",
    },
  },
  required: [],
};
