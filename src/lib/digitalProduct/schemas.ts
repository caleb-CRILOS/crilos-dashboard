// Plain JSON Schema for the finished digital product, passed to the Claude
// Code CLI's --json-schema flag once the model has emitted
// PRODUCT_COMPLETE_SENTINEL. The extraction re-reads Echo's reviewed draft
// (already in the resumed conversation) and splits it into title/sections
// using the "## <heading>" markers Quill was told to write.

export const digitalProductSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Short, punchy title for the digital product.",
    },
    subtitle: {
      type: "string",
      description: "One-line subtitle or description of who it's for / what it does.",
    },
    productType: {
      type: "string",
      description:
        "Freeform label for what kind of product this is, e.g. 'Workbook', 'Checklist', 'eBook', 'Swipe File'.",
    },
    targetPages: {
      type: "number",
      description: "Roughly how many pages the client asked for.",
    },
    outputFormat: {
      type: "string",
      enum: ["word", "pdf"],
      description: "The file format the client asked for: word or pdf.",
    },
    sections: {
      type: "array",
      description: "The product's sections in order, from Echo's reviewed draft.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "The section's heading." },
          body: { type: "string", description: "The section's full body text." },
        },
        required: [],
      },
    },
  },
  required: [],
};
