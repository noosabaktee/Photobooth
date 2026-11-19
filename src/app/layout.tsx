import type { Metadata } from "next";
import "./globals.css";
import "./kiosk.css";
import "./event.css";
import "./self-service.css";
import { eventIdentity } from "@/lib/event";
export const metadata: Metadata = {
  title: {
    default: `${eventIdentity.name} | ${eventIdentity.company}`,
    template: `%s · ${eventIdentity.name}`,
  },
  description: `Photobooth ${eventIdentity.name}, ${eventIdentity.company}. Ajak rekan satu tim, pilih frame, dan abadikan keseruan bersama.`,
  icons: { icon: "/event-icon.svg" },
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
