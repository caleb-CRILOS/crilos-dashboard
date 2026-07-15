// Plain JSON Schema used to bookkeep which of the 5 stages was just
// confirmed for a drafted reply, passed to the Claude Code CLI's
// --json-schema flag right after the present turn completes. Purely for
// the session-list UI (a stage badge next to each lead thread) -- not
// used to drive any drafting logic.

export const dmStageSchema = {
  type: "object",
  properties: {
    stage: {
      type: "string",
      enum: ["Respond", "Relate", "Assess", "Frame", "Ask"],
      description: "The stage of the DM conversation that was just confirmed for the reply that was drafted.",
    },
  },
  required: ["stage"],
};
