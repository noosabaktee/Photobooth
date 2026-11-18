"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="section-wrap">
      <h1>Ada kendala sementara.</h1>
      <p>
        Muat ulang halaman atau coba lagi. Hasil yang sudah di Drive tetap ada.
      </p>
      <Button onClick={reset}>Coba lagi</Button>
    </main>
  );
}
