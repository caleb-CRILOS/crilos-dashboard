import { Document, Page, Text, View } from "@react-pdf/renderer";
import { HawkAsset } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";

export default function HawkAssetPdf({
  asset,
  clientLabel,
}: {
  asset: HawkAsset;
  clientLabel: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  return (
    <Document title={asset.assetType || "Sales Outreach Asset"}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(clientLabel)}</Text>
        <Text style={s.title}>{asset.assetType || "Sales Outreach Asset"}</Text>
        <Text style={s.subtitle}>
          {asset.prospectLabel || "Prospect n/a"} — {clientLabel}
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
