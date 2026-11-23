import type { PublicFrame } from "./schema";

export const starterStyles = ["gingham", "film", "mint"] as const;
export type StarterStyle = (typeof starterStyles)[number];
export const starterPalette = {
  gingham: { background: "#fce7ec", ink: "#9a4964" },
  film: { background: "#202124", ink: "#f8e9c8" },
  mint: { background: "#ddf5e8", ink: "#287569" },
} as const;

export function selectedStarterStyle(
  frame: Pick<PublicFrame, "tags" | "name" | "dimensions">,
): StarterStyle | undefined {
  const presets = [
    ["starter-pink-3", "Pink Gingham", 1200, 2826, "gingham"],
    ["starter-film-3", "Vintage Film", 1000, 2486, "film"],
    ["starter-mint-3", "Mint Party", 1200, 2700, "mint"],
  ] as const;
  return presets.find(
    ([id, name, width, height]) =>
      frame.tags.includes(`seed:${id}`) ||
      (frame.name === name &&
        frame.dimensions.width === width &&
        frame.dimensions.height === height),
  )?.[4];
}

// The same artwork builds seed PNGs and extends their body behind printed QR.
// No event-green panel or white card is added to any theme.
export function starterBackdrop(
  style: StarterStyle,
  width: number,
  height: number,
) {
  const baseWidth = style === "film" ? 1000 : 1200;
  const h = (height * baseWidth) / width;
  let details = "";
  if (style === "gingham")
    details = `<defs><pattern id="gingham" width="108" height="108" patternUnits="userSpaceOnUse"><rect width="108" height="108" fill="#fce7ec"/><path d="M0 0h54v54H0zM54 54h54v54H54z" fill="#f7d2df"/></pattern></defs><rect width="100%" height="100%" fill="url(#gingham)"/><rect x="40" y="40" width="1120" height="${h - 80}" rx="40" fill="none" stroke="white" stroke-width="20"/><rect x="50" y="50" width="1100" height="${h - 100}" rx="30" fill="none" stroke="#e8a7bd" stroke-width="6"/>`;
  if (style === "film")
    details = `<g fill="#e3d9bc">${Array.from({ length: Math.ceil(h / 192) }, (_, i) => `<rect x="30" y="${60 + i * 192}" width="65" height="114" rx="18"/><rect x="905" y="${60 + i * 192}" width="65" height="114" rx="18"/>`).join("")}</g>`;
  if (style === "mint")
    details = `<rect x="32" y="32" width="1136" height="${h - 64}" rx="36" fill="none" stroke="#9ac5b8" stroke-width="7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${baseWidth} ${h}"><rect width="100%" height="100%" fill="${starterPalette[style].background}"/>${details}</svg>`;
}
