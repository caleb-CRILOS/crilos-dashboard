import { Document, Page, Text, View } from "@react-pdf/renderer";
import { IcaProfile, OnboardingProfile } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { businessLabel } from "./documentIdentity";

export default function IcaPdf({
  profile,
  ica,
}: {
  profile: OnboardingProfile;
  ica: IcaProfile;
}) {
  const s = buildPdfStyles(getActiveTokens());

  function Field({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
      <>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={s.fieldValue}>{value}</Text>
      </>
    );
  }

  return (
    <Document title="Ideal Client Avatar">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(profile.businessName)}</Text>
        <Text style={s.title}>Ideal Client Avatar</Text>
        <Text style={s.subtitle}>{profile.businessName || "Client business"}</Text>

        <Text style={s.sectionTitle}>Who this is for</Text>
        <Field label="Vertical / who they serve" value={ica.vertical} />
        <Field label="Ideal result" value={ica.idealResult} />

        <Text style={s.sectionTitle}>Ideal Customer Profile</Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Field label="Age" value={ica.icaAge} />
            <Field label="Gender" value={ica.icaGender} />
            <Field label="Occupation / industry" value={ica.icaOccupation} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Location" value={ica.icaLocation} />
            <Field label="Average annual income" value={ica.icaIncome} />
          </View>
        </View>
        <Field label="What keeps them up at night" value={ica.icaFears} />
        <Field label="What they're scared this problem says about them" value={ica.icaScared} />
        <Field label="What they avoid out of fear/anxiety" value={ica.icaAvoids} />
        <Field label="Worst-case scenario if they don't grow" value={ica.icaWorstCase} />
        <Field label="Where they feel powerless" value={ica.icaPowerless} />
        <Field label="What a signature offer would change" value={ica.icaSignatureOffer} />
        <Field label="What eases their fear of investing" value={ica.icaEaseFear} />

        <Text style={s.sectionTitle}>Customer Avatar</Text>
        <Text style={s.paragraph}>{ica.customerAvatar || "Not captured"}</Text>

        <Text style={s.sectionTitle}>Pain Points</Text>
        <Text style={s.paragraph}>{ica.painPoints || "Not captured"}</Text>

        <Text style={s.sectionTitle}>Goals & Dreams</Text>
        <Text style={s.paragraph}>{ica.goalsDreams || "Not captured"}</Text>

        <Text style={s.sectionTitle}>Who This Isn&apos;t For</Text>
        <Field label="Explicitly excluded" value={ica.icaExcludes} />
        <Field label="Most common objection" value={ica.icaObjection} />

        <View style={s.footer} fixed>
          <Text>{businessLabel(profile.businessName)}</Text>
        </View>
      </Page>
    </Document>
  );
}
