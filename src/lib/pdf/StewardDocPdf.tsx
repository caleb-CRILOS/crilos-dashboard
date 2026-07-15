import { Document, Page, Text, View } from "@react-pdf/renderer";
import { StewardAsset } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";

export default function StewardDocPdf({
  asset,
  clientLabel,
}: {
  asset: StewardAsset;
  clientLabel: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  return (
    <Document title={asset.docType || "Document Ops File"}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(clientLabel)}</Text>
        <Text style={s.title}>{asset.docType || "Document Ops File"}</Text>
        <Text style={s.subtitle}>
          {clientLabel} — {asset.audience || "audience n/a"}
        </Text>

        <Text style={s.sectionTitle}>Draft</Text>
        {cleanText(asset.finalText)
          .split(/\n+/)
          .map((para) => para.trim())
          .filter(Boolean)
          .map((para, i) => (
            <Text key={i} style={s.paragraph}>
              {para}
            </Text>
          ))}

        <View style={s.footer} fixed>
          <Text>{businessLabel(clientLabel)}</Text>
        </View>
      </Page>
    </Document>
  );
}
