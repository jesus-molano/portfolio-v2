import { CAREER, type Job, type JobId } from "@/features/career/career";
import type { Locale } from "@/i18n/config";

/**
 * The five stops of the night drive, in order: the career told by the
 * city's signs. The facts (ids, order, anchors, years, roles) are the
 * career module's (`features/career/career.ts`); this adds only where each
 * stop's board leads. The words live in `work.stops` in the dictionaries,
 * under the same ids.
 */
export type StopId = JobId;

export type StopDef = {
  id: StopId;
  index: Job["number"];
  anchor: Job["anchor"];
  /**
   * The employer's site, per locale. Null for the army: its board opens
   * its own service record (a popover), never an external page.
   */
  href: Record<Locale, string> | null;
  /** First and last year; null as the last year means the job is live. */
  years: Job["years"];
};

const SITES: Record<StopId, Record<Locale, string> | null> = {
  army: null,
  pwc: { en: "https://www.pwc.es/", es: "https://www.pwc.es/" },
  "cloud-district": { en: "https://clouddistrict.com/en/", es: "https://clouddistrict.com/" },
  logixs: { en: "https://www.logixsdigital.com/", es: "https://www.logixsdigital.com/" },
  heuristik: { en: "https://heuristik.com/en", es: "https://heuristik.com" },
};

export const STOPS: readonly StopDef[] = CAREER.map((job) => ({
  id: job.id,
  index: job.number,
  anchor: job.anchor,
  href: SITES[job.id],
  years: job.years,
}));

/** The id of the army's service-record popover. */
export const SERVICE_RECORD_ID = "service-record";

/** The domain a link opens, as the chip shows it ("pwc.es", "clouddistrict.com"). */
export function chipDomain(href: string): string {
  return new URL(href).hostname.replace(/^www\./, "");
}

/** Every external URL the work stage may link to (checked by the tests). */
export function stopLinks(): string[] {
  return STOPS.flatMap((stop) => (stop.href ? Object.values(stop.href) : []));
}
