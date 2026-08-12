import type { ReactNode } from "react";

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 };

const COLORS = {
  paper: "#f7f2e9",
  ink: "#16130f",
  muted: "#6b6259",
  orange: "#e2570f",
  orangeSoft: "#f3dfd1",
  line: "#d8cfc2",
};

type Stat = {
  label: string;
  value: ReactNode;
};

type SocialCardProps = {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  stats?: Stat[];
  footer?: ReactNode;
};

export function SocialCard({
  eyebrow,
  title,
  subtitle,
  stats = [],
  footer = "aafkarkivet.no",
}: SocialCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: COLORS.paper,
        color: COLORS.ink,
        padding: "68px 74px 58px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          color: COLORS.muted,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "0.03em",
        }}
      >
        <div
          style={{
            width: 42,
            height: 7,
            borderRadius: 999,
            background: COLORS.orange,
          }}
        />
        <span>{eyebrow}</span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 28,
          maxWidth: 1050,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 76,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.035em",
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              color: COLORS.muted,
              fontSize: 31,
              lineHeight: 1.3,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {stats.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 18,
            marginTop: "auto",
            width: "100%",
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 18,
                padding: "20px 22px 18px",
                background: "rgba(255,255,255,0.28)",
              }}
            >
              <span
                style={{
                  color: COLORS.muted,
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  marginTop: 8,
                  fontSize: 43,
                  lineHeight: 1,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: "auto" }} />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 28,
          paddingTop: 20,
          borderTop: `1px solid ${COLORS.line}`,
          color: COLORS.muted,
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: COLORS.orangeSoft,
              border: `7px solid ${COLORS.orange}`,
            }}
          />
          <span>AaFK arkivet</span>
        </div>
        <span>{footer}</span>
      </div>
    </div>
  );
}
