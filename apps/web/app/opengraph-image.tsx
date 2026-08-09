import { ImageResponse } from "next/og";
import { loadOverview } from "@/lib/archive";

export const runtime = "nodejs";

export const alt = "AaFK-arkivet – uoffisielt historisk arkiv";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const { totals } = loadOverview();

  return new ImageResponse(
    (
      <div
        style={{
          background: "#f7f2e9",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
          color: "#16130f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ width: "30px", height: "4px", background: "#e2570f", marginRight: "16px" }} />
          <span style={{ fontSize: "32px", color: "#6b6259", fontWeight: 500 }}>
            Uoffisielt historisk arkiv
          </span>
        </div>
        
        <h1
          style={{
            fontSize: "130px",
            fontWeight: 700,
            lineHeight: 1,
            margin: "0 0 40px 0",
            letterSpacing: "-0.03em",
          }}
        >
          AaFK-arkivet
        </h1>

        <div style={{ display: "flex", gap: "80px", marginTop: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "24px", color: "#6b6259", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Kamper</span>
            <span style={{ fontSize: "80px", fontWeight: 600, color: "#16130f", lineHeight: 1 }}>
              {totals.matches.toLocaleString("nb-NO")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* «Sesonger» leses som hele sesonger. Tallet er år med minst én
                registrert kamp, og delingsbildet er den mest kopierte flaten
                nettstedet har. */}
            <span style={{ fontSize: "24px", color: "#6b6259", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>År</span>
            <span style={{ fontSize: "80px", fontWeight: 600, color: "#16130f", lineHeight: 1 }}>
              {totals.seasons}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "24px", color: "#6b6259", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Motstandere</span>
            <span style={{ fontSize: "80px", fontWeight: 600, color: "#16130f", lineHeight: 1 }}>
              {totals.opponents}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
