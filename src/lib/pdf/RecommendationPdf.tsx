import { Document, Page, Text, View } from "@react-pdf/renderer";
import { OnboardingProfile } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";

export default function RecommendationPdf({
  profile,
  recommendation,
}: {
  profile: OnboardingProfile;
  recommendation: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  const clientName = profile.name || "there";
  const businessName = profile.businessName || "your business";

  return (
    <Document title="Your First Recommendation">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(profile.businessName)}</Text>
        <Text style={s.title}>Your First Recommendation</Text>
        <Text style={s.subtitle}>
          {clientName} — {businessName}
        </Text>

        <Text style={s.sectionTitle}>Where things stand</Text>
        <Text style={s.fieldLabel}>Core offer</Text>
        <Text style={s.fieldValue}>
          {profile.offer || "Not captured"}
          {profile.pricePoint ? ` — ${profile.pricePoint}` : ""}
        </Text>
        <Text style={s.fieldLabel}>Current bottleneck</Text>
        <Text style={s.fieldValue}>{profile.bottleneck || "Not captured"}</Text>
        <Text style={s.fieldLabel}>90-day goal</Text>
        <Text style={s.fieldValue}>{profile.goal90 || "Not captured"}</Text>

        <Text style={s.sectionTitle}>Your recommendation</Text>
        {cleanText(recommendation)
          .split(/\n+/)
          .map((para) => para.trim())
          .filter(Boolean)
          .map((para, i) => (
            <Text key={i} style={s.paragraph}>
              {para}
            </Text>
          ))}

        <View style={s.footer} fixed>
          <Text>{businessLabel(profile.businessName)}</Text>
        </View>
      </Page>
    </Document>
  );
}
