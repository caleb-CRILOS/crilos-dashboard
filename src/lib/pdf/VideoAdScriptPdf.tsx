import { Document, Page, Text, View } from "@react-pdf/renderer";
import { VideoAdScript } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";

const STEPS: { key: keyof VideoAdScript; label: string; window: string }[] = [
  { key: "hook", label: "Hook", window: "0-5 sec" },
  { key: "promise", label: "Promise", window: "5-15 sec" },
  { key: "valueBombResource", label: "Value Bomb Tease", window: "15-20 sec" },
  { key: "credibility", label: "Credibility", window: "20-30 sec" },
  { key: "problem", label: "The Problem", window: "30-60 sec" },
  { key: "whySolutionsFail", label: "Why Solutions Fail", window: "60-105 sec" },
  { key: "solutionSteps", label: "Your Solution", window: "105-165 sec" },
  { key: "whyItWorks", label: "Why It Works", window: "165-180 sec" },
  { key: "cta", label: "Call to Action", window: "180-210 sec" },
];

export default function VideoAdScriptPdf({
  script,
  clientLabel,
}: {
  script: VideoAdScript;
  clientLabel: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  const title = script.hook ? "Video Ad Script" : "Video Ad Script";

  return (
    <Document title={title}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(clientLabel)}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>
          {clientLabel} — {script.platform || "platform n/a"}
        </Text>

        {script.valueBombKeyword && (
          <>
            <Text style={s.fieldLabel}>Value bomb</Text>
            <Text style={s.fieldValue}>
              Keyword &quot;{script.valueBombKeyword}&quot; → {script.valueBombResource || "resource n/a"}
            </Text>
          </>
        )}

        {script.finalScript ? (
          <>
            <Text style={s.sectionTitle}>Script</Text>
            {cleanText(script.finalScript)
              .split(/\n+/)
              .map((para) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <Text key={i} style={s.paragraph}>
                  {para}
                </Text>
              ))}
          </>
        ) : (
          STEPS.map(
            (step) =>
              script[step.key] && (
                <View key={step.key} wrap={false}>
                  <Text style={s.fieldLabel}>
                    {step.label} ({step.window})
                  </Text>
                  <Text style={s.fieldValue}>{cleanText(String(script[step.key]))}</Text>
                </View>
              ),
          )
        )}

        <View style={s.footer} fixed>
          <Text>{businessLabel(clientLabel)}</Text>
        </View>
      </Page>
    </Document>
  );
}
