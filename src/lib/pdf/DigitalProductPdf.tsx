import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import fs from "fs";
import { DigitalProductAsset } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";
import { deliverablePath } from "./generate";

export default function DigitalProductPdf({
  asset,
  clientLabel,
}: {
  asset: DigitalProductAsset;
  clientLabel: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  // A rendered cover (src/lib/covers/renderCover.ts) becomes a full-bleed
  // page 1 when present -- guard on the file actually existing so a stale
  // pointer never breaks PDF generation.
  const coverPath =
    asset.coverImageFileName && fs.existsSync(deliverablePath(asset.coverImageFileName))
      ? deliverablePath(asset.coverImageFileName)
      : null;
  return (
    <Document title={asset.title || "Digital Product"}>
      {coverPath && (
        <Page size="A4" style={{ padding: 0 }}>
          {/* react-pdf Image, not an HTML img -- no alt prop exists */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={coverPath} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Page>
      )}
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
