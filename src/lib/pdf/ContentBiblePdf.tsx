import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  ContentBible,
  ContentBibleGoalRow,
  ContentBibleStepRow,
  OnboardingProfile,
} from "../types";
import { buildPdfStyles, PdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { businessLabel } from "./documentIdentity";

function GoalTable({ goals, s }: { goals: ContentBibleGoalRow[]; s: PdfStyles }) {
  if (!goals || goals.length === 0) return null;
  const columns: [string, keyof ContentBibleGoalRow][] = [
    ["Goal / Milestone", "goal"],
    ["Mechanism", "mechanism"],
    ["Problem Solved", "problem"],
    ["Knows When...", "knowsWhen"],
  ];
  return (
    <View style={s.table}>
      <View style={s.tableRow}>
        {columns.map(([label]) => (
          <Text key={label} style={s.tableHeaderCell}>
            {label}
          </Text>
        ))}
      </View>
      {goals.map((row, i) => (
        <View key={i} style={i === goals.length - 1 ? s.tableRowLast : s.tableRow}>
          {columns.map(([label, key], ci) => (
            <Text key={label} style={ci === 0 ? s.tableCellFirst : s.tableCell}>
              {row[key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function StepTable({ steps, s }: { steps: ContentBibleStepRow[] | undefined; s: PdfStyles }) {
  if (!steps || steps.length === 0) return null;
  const columns: [string, "step" | "problem" | "resource"][] = [
    ["Step", "step"],
    ["Problem It Solves", "problem"],
    ["Resource", "resource"],
  ];
  return (
    <View style={s.table}>
      <View style={s.tableRow}>
        {columns.map(([label]) => (
          <Text key={label} style={s.tableHeaderCell}>
            {label}
          </Text>
        ))}
      </View>
      {steps.map((row, i) => (
        <View key={i} style={i === steps.length - 1 ? s.tableRowLast : s.tableRow}>
          {columns.map(([label, key], ci) => (
            <Text key={label} style={ci === 0 ? s.tableCellFirst : s.tableCell}>
              {row[key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function ContentBiblePdf({
  profile,
  contentBible,
}: {
  profile: OnboardingProfile;
  contentBible: ContentBible;
}) {
  const s = buildPdfStyles(getActiveTokens());
  const goals = contentBible.goals ?? [];
  const steps = contentBible.steps ?? [];

  return (
    <Document title="Content Bible">
      <Page size="A4" style={s.page} wrap>
        <Text style={s.eyebrow}>{businessLabel(profile.businessName)}</Text>
        <Text style={s.title}>
          Content Bible{contentBible.methodologyName ? ` — ${contentBible.methodologyName}` : ""}
        </Text>
        <Text style={s.subtitle}>{profile.businessName || "Client business"}</Text>

        <Text style={s.sectionTitle}>The Overall Journey</Text>
        <Text style={s.paragraph}>{contentBible.overallAim || "Not captured"}</Text>
        <GoalTable goals={goals} s={s} />
        {contentBible.objections && (
          <>
            <Text style={s.fieldLabel}>Common objections</Text>
            <Text style={s.fieldValue}>{contentBible.objections}</Text>
          </>
        )}
        {contentBible.voc && (
          <>
            <Text style={s.fieldLabel}>Voice of the Customer</Text>
            <Text style={s.fieldValue}>{contentBible.voc}</Text>
          </>
        )}

        {goals.map((goal, i) => (
          <View key={i} wrap={false} style={{ marginTop: 12 }}>
            <Text style={s.sectionTitle}>
              Steps to Accomplish Goal {i + 1}: {goal.goal}
            </Text>
            <StepTable steps={steps[i]} s={s} />
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>{businessLabel(profile.businessName)}</Text>
        </View>
      </Page>
    </Document>
  );
}
