// eslint-disable-next-line @typescript-eslint/no-unused-vars -- classic JSX runtime under vite-node
import React from "react";
import { ImageResponse } from "next/og";
import { SITE } from "../../lib/site";
import { MazeMark } from "./brand-art";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: SITE.paper, padding: "0 80px", gap: 70 }}>
        <div style={{ display: "flex", padding: 34, borderRadius: 48, background: "#fffaf3", boxShadow: "0 30px 60px -30px rgba(60,40,30,0.45)" }}>
          <MazeMark size={360} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: SITE.accent2 }}>Un juego para dos</div>
          <div style={{ fontSize: 92, lineHeight: 1.02, color: SITE.ink, marginTop: 18, fontWeight: 700 }}>{SITE.name}</div>
          <div style={{ fontSize: 34, lineHeight: 1.3, color: "#6b6170", marginTop: 26 }}>
            Una persona explora entre la niebla. La otra tiene el mapa. Solo se tienen a sí mismos… y una videollamada.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
