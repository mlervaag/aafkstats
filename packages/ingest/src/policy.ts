import { mayFetch, mayPublish } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import type { Source } from "@aafkstats/schema";

/**
 * Porten mellom «kan hentes» og «kan publiseres».
 *
 * Det er to forskjellige spørsmål, og de blandes lett. At et sluttresultat er et
 * faktum uten opphavsrett sier ingenting om databasevernet på samlingen det ble
 * hentet fra, og heller ikke om vilkårene kilden selv har satt. En adapter som
 * virker teknisk utmerket er ikke et argument for å publisere.
 *
 * Derfor er statusen data i `data/sources/*.yaml` og ikke prosa i et notat: den
 * kan leses av en maskin, og skrivesteget kan nekte. `unknown` regnes aldri som
 * et ja — det er hele forskjellen mellom å ha vurdert noe og å ikke ha gjort det.
 *
 * Tørrkjøring er alltid tillatt. Å undersøke hva en kilde inneholder er nettopp
 * det man må gjøre for å kunne be om tillatelse til å bruke den.
 */

export class SourcePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcePolicyError";
  }
}

function findSource(archive: Archive, sourceId: string): Source {
  const source = archive.sources.find((entry) => entry.id === sourceId);
  if (!source) {
    throw new SourcePolicyError(
      `Kilden «${sourceId}» finnes ikke i data/sources/. ` +
        "Legg den inn med rettighetsstatus før du høster fra den.",
    );
  }
  return source;
}

/** Kaster hvis kilden ikke kan hentes automatisk. Kalles før nettverkskall. */
export function assertMayFetch(archive: Archive, sourceId: string): void {
  const source = findSource(archive, sourceId);
  if (mayFetch(source)) return;

  throw new SourcePolicyError(
    `Automatisert henting fra «${source.name}» er ikke avklart ` +
      `(automatedAccess: ${source.automatedAccess}, permissionStatus: ${source.permissionStatus}, ` +
      `ingestDecision: ${source.ingestDecision}).\n` +
      (source.permissionNote ? `\n${source.permissionNote.trim()}\n` : "") +
      `\nOppdater data/sources/${source.id}.yaml når status endrer seg.`,
  );
}

/**
 * Kaster hvis kilden ikke kan publiseres videre. Kalles før `--write`.
 *
 * Meldingen sier hva som mangler og hvor det står, slik at neste steg er
 * åpenbart — å be om tillatelse, ikke å lete etter en flagg som slår av porten.
 * Det finnes ingen slik flagg med vilje.
 */
export function assertMayPublish(archive: Archive, sourceId: string): void {
  const source = findSource(archive, sourceId);
  if (mayPublish(source)) return;

  throw new SourcePolicyError(
    `Kan ikke skrive data fra «${source.name}» til arkivet.\n\n` +
      `Arkivet er offentlig, og offentlig gjenbruk fra denne kilden er ikke avklart:\n` +
      `  publicRedistribution: ${source.publicRedistribution}\n` +
      `  permissionStatus:     ${source.permissionStatus}   (hva motparten har sagt)\n` +
      `  ingestDecision:       ${source.ingestDecision}   (hva vi har bestemt)\n` +
      (source.permissionNote ? `\n${source.permissionNote.trim()}\n` : "") +
      `\nTørrkjøring virker fortsatt — det er lov å undersøke hva kilden inneholder.\n` +
      `Når tillatelse foreligger, sett permissionStatus: granted i ` +
      `data/sources/${source.id}.yaml og noter hvem som ga den.\n` +
      `Skal det gås videre uten tillatelse, er det ingestDecision: accepted_risk — ` +
      `med riskAcceptedAt og riskAcceptedBy, så beslutningen har et navn og en dato.`,
  );
}
