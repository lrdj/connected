import fs from "node:fs";

/**
 * Rasterise an SVG to PNG for quick checks. Uses sharp, which is a dev
 * dependency only; the main outputs never need it.
 */
export async function svgToPng(svgPath: string, pngPath: string, width?: number): Promise<void> {
  const { default: sharp } = await import("sharp");
  const svg = fs.readFileSync(svgPath);
  let image = sharp(svg, { density: 96 });
  if (width) image = image.resize({ width });
  await image.flatten({ background: "#ffffff" }).png().toFile(pngPath);
}
