import { Document, Page, Text, View } from "@react-pdf/renderer";
import { DigitalProductAsset } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";

export default function DigitalProductPdf({
  asset,
  clientLabel,
}: {
  asset: DigitalProductAsset;
  clientLabel: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  return (
    <Document title={asset.title || "Digital Product"}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(clientLabel)}</Text>
        <Text style={s.title}>{asset.title || "Digital Product"}</Text>
        <Text style={s.subtitle}>
          {clientLabel}
          {asset.productType ? ` — ${asset.productType}` : ""}
        </Text>
        {asset.subtitle && <Text style={s.paragraph}>{cleanText(asset.subtitle)}</Text>}

        {(asset.sections ?? []).map((section, i) => (
          <View key={i}>
            <Text style={s.sectionTitle}>{section.heading}</Text>
            {cleanText(section.body)
              .split(/\n+/)
              .map((para) => para.trim())
              .filter(Boolean)
              .map((para, j) => (
                <Text key={j} style={s.paragraph}>
                  {para}
                </Text>
              ))}
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>{businessLabel(clientLabel)}</Text>
        </View>
      </Page>
    </Document>
  );
}
