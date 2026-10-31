// eslint-disable-next-line @typescript-eslint/no-unused-vars -- classic JSX runtime under vite-node
import React from "react";
import { ImageResponse } from "next/og";
import { SITE } from "../../lib/site";
import { MazeMark } from "./brand-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: SITE.paper }}>
        <MazeMark size={150} />
      </div>
    ),
    size,
  );
}
