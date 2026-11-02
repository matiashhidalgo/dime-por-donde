// eslint-disable-next-line @typescript-eslint/no-unused-vars -- classic JSX runtime under vite-node
import React from "react";
import { ImageResponse } from "next/og";
import { SITE } from "../../lib/site";
import { MazeMark } from "./brand-art";

/**
 * Home-screen icons for the web app manifest. `maskable` icons get a full-bleed
 * background and a mark inside the central 60 % (Android crops them to a circle
 * or a squircle; the safe zone is the inner 80 % circle).
 */
export function appIcon(px: number, maskable: boolean) {
  const mark = Math.round(px * (maskable ? 0.56 : 0.76));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: SITE.paper }}>
        <MazeMark size={mark} />
      </div>
    ),
    { width: px, height: px },
  );
}
