// Plain JSON Schema for the finished compose-email draft, passed to the
// Claude Code CLI's --json-schema flag once Quill has drafted and Echo has
// reviewed it (see EMAIL_DRAFT_REQUESTED_SENTINEL in prompts.ts).

export const composeEmailSchema = {
  type: "object",
  properties: {
    to: {
      type: "string",
      description: "The recipient's email address, as confirmed in the conversation.",
    },
    subject: { type: "string" },
    bodyText: {
      type: "string",
      description: "The complete email body, exactly as Echo delivered it -- no subject line in this field.",
    },
  },
  required: [],
};
