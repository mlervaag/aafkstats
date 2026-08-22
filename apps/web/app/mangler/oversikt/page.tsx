import type { Metadata } from "next";
import { MissingOverviewContent } from "../MissingOverviewContent";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "Hele arbeidskøen",
  "En oppdatert oversikt over historiske resultater, kampdetaljer og kildekonflikter som AaFK-arkivet trenger hjelp med.",
  "/mangler/oversikt",
  "website",
);

export default function MissingOverviewPage() {
  return <MissingOverviewContent />;
}
