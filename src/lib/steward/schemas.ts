// Plain JSON Schema, passed to the Claude Code CLI's --json-schema flag.
// Extracted twice per completed doc: once right after Steward's own
// draft (to read the audience field and decide whether Echo runs at
// all), and once more at the end for the final text once Atlas presents.

export const stewardAudienceSchema = {
  type: "object",
  properties: {
    audience: {
      type: "string",
      enum: ["client-facing", "internal"],
      description: "Whether the doc just drafted is client-facing or internal-only.",
    },
  },
  required: ["audience"],
};

export const stewardAssetSchema = {
  type: "object",
  properties: {
    docType: {
      type: "string",
      description: "onboarding doc, session notes, SOP, recap email, or program material",
    },
    audience: { type: "string", enum: ["client-facing", "internal"] },
    outputFormat: {
      type: "string",
      enum: ["word", "pdf", "powerpoint", "email-html"],
      description: "The file format the client asked for: word, pdf, powerpoint, or email-html.",
    },
    finalText: {
      type: "string",
      description: "The complete, final doc exactly as delivered.",
    },
  },
  required: [],
};
