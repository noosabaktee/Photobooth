import {
  starterBackdrop,
  starterPalette,
  type StarterStyle,
} from "./starter-artwork";
import { eventIdentity } from "./event";

export const videoLayout = {
  width: 1080,
  height: 1920,
  photo: { x: 90, y: 260, width: 900, height: 1200 },
  footerTop: 1552,
  qrBox: 264,
  qrX: 128,
  qrY: 1600,
} as const;

export function videoArtwork(style: StarterStyle = "mint") {
  const backdrop = starterBackdrop(style, 1080, 1920);
  // Keep copy in native video coordinates; the nested backdrop has its own
  // source-artwork viewBox (1000/1200 px), independent of the 1080 px card.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">${backdrop}<g text-anchor="middle" font-family="sans-serif" fill="${starterPalette[style].ink}"><text x="540" y="120" font-size="60" font-weight="bold">${eventIdentity.name}</text><text x="540" y="178" font-size="27">${eventIdentity.company}</text><text x="540" y="1525" font-size="32" font-weight="bold">${eventIdentity.tagline}</text><text x="540" y="1780" font-size="24">HOYA-HOYA MEMORIES</text></g></svg>`;
}
