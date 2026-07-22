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

        {/* The post-ready extras. Caption only earns its own section when it
            differs from the draft -- on a single-image post they're the same
            text, and printing it twice just pads the PDF. */}
        {piece.caption && cleanText(piece.caption) !== cleanText(piece.finalText) && (
          <>
            <Text style={s.sectionTitle}>Caption</Text>
            {cleanText(piece.caption)
              .split(/\n+/)
              .map((para) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <Text key={i} style={s.paragraph}>
                  {para}
                </Text>
              ))}
          </>
        )}

        {piece.hashtags && piece.hashtags.length > 0 && (
          <>
            <Text style={s.fieldLabel}>Hashtags</Text>
            <Text style={s.fieldValue}>
              {piece.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}
            </Text>
          </>
        )}

        {piece.hookVariants && piece.hookVariants.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Alternate hooks</Text>
            {piece.hookVariants.map((hook, i) => (
              <Text key={i} style={s.paragraph}>
                {i + 1}. {cleanText(hook)}
              </Text>
            ))}
          </>
        )}

        {piece.imageConcept && (
          <>
            <Text style={s.fieldLabel}>Image concept</Text>
            <Text style={s.fieldValue}>{cleanText(piece.imageConcept)}</Text>
          </>
        )}

        {piece.suggestedPostAt && (
          <>
            <Text style={s.fieldLabel}>Suggested posting time</Text>
            <Text style={s.fieldValue}>{piece.suggestedPostAt}</Text>
          </>
        )}

        <View style={s.footer} fixed>
          <Text>{businessLabel(clientLabel)}</Text>
        </View>
      </Page>
    </Document>
  );
}
