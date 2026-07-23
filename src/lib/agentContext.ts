// Shared "client context" block embedded in every agent's system prompt
// (Atlas, Quill, Echo) across the chat-driven tools. Each Claude CLI call
// gets its own fresh --system-prompt even when resuming the same session
// (see extractStructured in claude-cli.ts for the established pattern), so
// every agent needs this context re-embedded rather than inherited.

import { ContentGuide, IcaProfile, OnboardingProfile, OnboardingSession, VoiceProfile } from "./types";
import { brandingContextBlock } from "./branding/standard";

// No client picker in these tools' UIs -- always draft against whichever
// onboarded client's data is most complete/most recent, so drafts still
// come from real context instead of asking the user to pick every time.
export function pickDefaultOnboardingSession(
  sessions: OnboardingSession[],
): OnboardingSession | undefined {
  const withIdentity = sessions.filter((s) => s.profile.businessName || s.profile.name);
  if (withIdentity.length === 0) return undefined;

  function rank(s: OnboardingSession): number {
    if (s.contentGuideComplete) return 3;
    if (s.icaComplete) return 2;
    if (s.setupComplete) return 1;
    return 0;
  }

  return [...withIdentity].sort((a, b) => {
    const rankDiff = rank(b) - rank(a);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}

// Real per-client lookup, used once a client picker supplies a clientId.
// Falls back to pickDefaultOnboardingSession (above) only when no client
// was selected at all, e.g. a generic/test draft.
export function pickOnboardingSessionForClient(
  sessions: OnboardingSession[],
  clientId: string | undefined,
): OnboardingSession | undefined {
  if (!clientId) return undefined;
  return sessions.find((s) => s.clientId === clientId);
}

export function fieldOrNone(value?: string): string {
  return value && value.trim() ? value : "(not captured)";
}

export function buildClientContextBlock(opts: {
  profile?: OnboardingProfile;
  voice?: VoiceProfile;
  ica?: IcaProfile;
  contentGuide?: ContentGuide;
  noClientMessage: string;
}): string {
  const { profile, voice, ica, contentGuide, noClientMessage } = opts;
  const hasClient = !!(profile && Object.keys(profile).length > 0);

  // The active branding standard (if any) is appended to every agent's
  // context block, so any tool that produces a document or HTML output
  // styles it to the user's brand. Empty string when no standard is set.
  const branding = brandingContextBlock();
  const withBranding = (block: string) => (branding ? `${block}\n\n${branding}` : block);

  if (!hasClient) {
    return withBranding(`## Client context\n\n${noClientMessage}`);
  }

  return withBranding(`## Client context (already on file -- don't re-ask for any of this)

Business: ${fieldOrNone(profile!.businessName)} -- ${fieldOrNone(profile!.whatTheyDo)}
Offer: ${fieldOrNone(profile!.offer)} at ${fieldOrNone(profile!.pricePoint)}

Voice: tone ${fieldOrNone(voice?.toneDescriptors)}, energy ${fieldOrNone(voice?.energyLevel)}, formality ${fieldOrNone(voice?.formality)}, humor ${fieldOrNone(voice?.humor)}
Words to avoid: ${fieldOrNone(voice?.wordsAvoided)}
Claims that need a specific detail supplied rather than being invented: ${fieldOrNone(voice?.claimsGuarded)}

ICA vertical: ${fieldOrNone(ica?.vertical)}, ideal result: ${fieldOrNone(ica?.idealResult)}
ICA pain points: ${fieldOrNone(ica?.painPoints)}
Most common objection: ${fieldOrNone(ica?.icaObjection)}

Content guide goals/mechanisms:
${
  contentGuide?.goals && contentGuide.goals.length > 0
    ? contentGuide.goals
        .map((g, i) => `${i + 1}. Goal: ${g.goal} -- Mechanism: ${g.mechanism} -- Solves: ${g.problem}`)
        .join("\n")
    : "(not captured yet)"
}
Voice of the customer quotes: ${fieldOrNone(contentGuide?.voc)}
Methodology name: ${fieldOrNone(contentGuide?.methodologyName)}`);
}
