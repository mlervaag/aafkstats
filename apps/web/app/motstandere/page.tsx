import type { Metadata } from "next";
import { loadOpponents } from "@/lib/archive";

export const metadata: Metadata = {
  title: "Motstandere",
  description: "Innbyrdes statistikk mot alle AaFKs motstandere gjennom arkivet.",
};
export const dynamic = "force-dynamic";

export default function OpponentsPage() {
  const opponents = loadOpponents();
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">{opponents.length} lag</p>
        <h1>Motstandere</h1>
        <p className="lede">Innbyrdes statistikk i de ligakampene som foreløpig finnes i arkivet.</p>
      </header>
      <div className="opponent-list">
        {opponents.map((opponent) => (
          <a href={opponent.url} key={opponent.id}>
            <span><strong>{opponent.opponent}</strong>{opponent.city && <small>{opponent.city}</small>}</span>
            <span className="record-line num">{opponent.wins} S · {opponent.draws} U · {opponent.losses} T</span>
            <span className="num muted">{opponent.played} kamper</span>
          </a>
        ))}
      </div>
    </>
  );
}
