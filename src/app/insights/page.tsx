import { getDb } from "@/lib/db";
import InsightsClient from "./InsightsClient";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const db = await getDb();
  const outcomes = db.data.dmConversionOutcomes;
  const dm2CloseMetrics = {
    total: outcomes.length,
    yes: outcomes.filter((o) => o.converted).length,
    no: outcomes.filter((o) => !o.converted).length,
  };
  return (
    <InsightsClient initialInsights={db.data.insights} dm2CloseMetrics={dm2CloseMetrics} />
  );
}
