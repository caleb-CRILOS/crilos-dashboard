// Plain JSON Schema for the finished asset, passed to the Claude Code
// CLI's --json-schema flag once the model has emitted
// ASSET_COMPLETE_SENTINEL.

export const hawkAssetSchema = {
  type: "object",
  properties: {
    assetType: {
      type: "string",
      description: "outreach copy, proposal, discovery-call prep, or follow-up sequence",
    },
    prospectLabel: {
      type: "string",
      description: "Short label for who this asset is for, e.g. 'Discovery call -- Jane at Acme'.",
    },
    outputFormat: {
      type: "string",
      enum: ["word", "pdf", "powerpoint", "email-html"],
      description: "The file format the client asked for: word, pdf, powerpoint, or email-html.",
    },
    finalText: {
      type: "string",
      description: "The complete, final sales asset exactly as delivered to the client.",
    },
  },
  required: [],
};
