// Plain JSON Schema for each stage's structured result, passed to the
// Claude Code CLI's --json-schema flag on the "finalize" call that follows
// the STAGE_COMPLETE sentinel (see prompts.ts). One schema per stage,
// matching the corresponding type in ../types.ts field-for-field.

export const setupSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "string" },
    businessName: { type: "string" },
    owner: { type: "string" },
    whatTheyDo: { type: "string" },
    website: { type: "string" },
    leadSource: { type: "string" },
    offer: { type: "string" },
    pricePoint: { type: "string" },
    deliveryFormat: { type: "string" },
    crm: { type: "string" },
    calendar: { type: "string" },
    emailTool: { type: "string" },
    payment: { type: "string" },
    otherTools: { type: "string" },
    goal90: { type: "string" },
    bottleneck: { type: "string" },
    kpis: { type: "string" },
    dreamOutcome: { type: "string" },
    toneDescriptors: { type: "string" },
    energyLevel: { type: "string" },
    formality: { type: "string" },
    humor: { type: "string" },
    wordsUsed: { type: "string" },
    wordsAvoided: { type: "string" },
    jargon: { type: "string" },
    sentenceLength: { type: "string" },
    paragraphLength: { type: "string" },
    contractions: { type: "string" },
    formattingQuirks: { type: "string" },
    claimsOk: { type: "string" },
    claimsGuarded: { type: "string" },
    samples: { type: "array", items: { type: "string" } },
  },
  required: [],
};

export const icaSchema = {
  type: "object",
  properties: {
    vertical: { type: "string" },
    idealResult: { type: "string" },
    icaAge: { type: "string" },
    icaGender: { type: "string" },
    icaOccupation: { type: "string" },
    icaLocation: { type: "string" },
    icaIncome: { type: "string" },
    icaFears: { type: "string" },
    icaScared: { type: "string" },
    icaAvoids: { type: "string" },
    icaWorstCase: { type: "string" },
    icaPowerless: { type: "string" },
    icaSignatureOffer: { type: "string" },
    icaEaseFear: { type: "string" },
    customerAvatar: { type: "string" },
    painPoints: { type: "string" },
    goalsDreams: { type: "string" },
    icaExcludes: { type: "string" },
    icaObjection: { type: "string" },
  },
  required: [],
};

export const contentGuideSchema = {
  type: "object",
  properties: {
    overallAim: { type: "string" },
    goals: {
      type: "array",
      description: "Exactly 3 goal/milestone rows from Action 1.",
      items: {
        type: "object",
        properties: {
          goal: { type: "string" },
          mechanism: { type: "string" },
          problem: { type: "string" },
          knowsWhen: { type: "string" },
        },
        required: ["goal", "mechanism", "problem", "knowsWhen"],
      },
    },
    objections: { type: "string" },
    voc: { type: "string" },
    methodologyName: { type: "string" },
    steps: {
      type: "array",
      description:
        "One array per goal (same order as goals), each containing that goal's 4-6 expanded steps.",
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            step: { type: "string" },
            problem: { type: "string" },
            resource: { type: "string" },
          },
          required: ["step", "problem", "resource"],
        },
      },
    },
  },
  required: [],
};
