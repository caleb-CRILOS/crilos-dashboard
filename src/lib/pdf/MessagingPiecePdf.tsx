import { Document, Page, Text, View } from "@react-pdf/renderer";
import { MessagingPiece } from "../types";
import { buildPdfStyles } from "./styles";
import { getActiveTokens } from "../branding/standard";
import { cleanText } from "./markdown";
import { businessLabel } from "./documentIdentity";

export default function MessagingPiecePdf({
  piece,
  clientLabel,
}: {
  piece: MessagingPiece;
  clientLabel: string;
}) {
  const s = buildPdfStyles(getActiveTokens());
  return (
    <Document title={piece.topic || "Content Piece"}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{businessLabel(clientLabel)}</Text>
        <Text style={s.title}>{piece.topic || "Content Piece"}</Text>
        <Text style={s.subtitle}>
          {clientLabel} — {piece.format || "format n/a"} for {piece.platform || "platform n/a"}
        </Text>

        {piece.cta && (
          <>
            <Text style={s.fieldLabel}>Call to action</Text>
            <Text style={s.fieldValue}>{piece.cta}</Text>
          </>
        )}

        <Text style={s.sectionTitle}>Draft</Text>
        {cleanText(piece.finalText)
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
