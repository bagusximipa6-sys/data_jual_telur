import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Sahabat Telur - Data Penjualan Telur";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const manropeBold = await readFile(join(process.cwd(), "app/fonts/Manrope-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "#191712",
        }}
      >
        <div
          style={{
            fontFamily: "Manrope",
            fontSize: 80,
            fontWeight: 700,
            color: "#d9ff67",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          Sahabat Telur
        </div>
        <div
          style={{
            fontFamily: "Manrope",
            fontSize: 48,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            display: "flex",
            alignItems: "center",
          }}
        >
          Data Penjualan Telur
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Manrope",
          data: manropeBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
