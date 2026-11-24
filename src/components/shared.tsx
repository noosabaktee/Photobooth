import Link from "next/link";
import { Aperture, ArrowUpRight } from "lucide-react";
import { eventIdentity } from "@/lib/event";
export function Header() {
  return (
    <header className="site-header">
      <Link
        className="brand"
        href="/"
        aria-label={`${eventIdentity.name} beranda`}
      >
        <span className="brand-icon">
          <Aperture size={23} />
        </span>
        <span className="brand-copy">
          <strong>{eventIdentity.name}</strong>
          <span>{eventIdentity.company}</span>
        </span>
      </Link>
    </header>
  );
}
export function Privacy() {
  return (
    <div className="privacy-note">
      <strong>Momenmu, pilihanmu.</strong> Foto asli berada di memori browser.
      Saat kamu membuka kamera dan memulai countdown, layanan ini memproses foto
      sementara di server dan otomatis menyimpan kolase PNG + video MP4 ke Drive
      setelah foto terakhir. File sementara dihapus setelah proses
      selesai/gagal. Folder hasil dapat dibuka siapa saja yang punya link; QR
      yang sama juga dicetak pada PNG. Hasil di layar dihapus otomatis setelah
      durasi scan yang diatur pengelola (default 15 detik), atau saat refresh.
      File Drive tetap tersimpan. Hubungi pengelola acara untuk penghapusan.
      Mode demo tidak menyimpan hasil ke Drive dan tidak membuat QR palsu.
    </div>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>
        {eventIdentity.name} · {eventIdentity.company}
      </span>
      <Link href="/admin">
        Ruang pengelola <ArrowUpRight size={14} />
      </Link>
    </footer>
  );
}
