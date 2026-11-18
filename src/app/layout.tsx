import type { Metadata } from "next";
import "./globals.css";
import "./kiosk.css";
export const metadata: Metadata = {
  title: {
    default: "Snapstrip — A little moment, a forever memory.",
    template: "%s · Snapstrip",
  },
  description:
    "Photobooth di browser. Pilih frame, jepret bersama, dan simpan momen favoritmu. Tanpa akun.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
