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
      <nav aria-label="Navigasi utama">
        <Link href="/?view=how">Cara main</Link>
        <Link href="/?view=frames">Koleksi frame</Link>
        <Link className="nav-booth" href="/booth">
          Masuk booth <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
export function Privacy() {
  return (
    <div className="privacy-note">
      <strong>Momenmu, pilihanmu.</strong> Foto asli diproses di memori browser.
      Download lokal tersedia tanpa upload. Jika kamu memilih simpan ke Drive
      pengelola, hasil dapat dibuka siapa saja yang punya link dan tetap
      tersimpan setelah tab ditutup. QR dan foto di halaman ini hilang saat
      refresh. Hubungi pengelola acara untuk penghapusan.
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
