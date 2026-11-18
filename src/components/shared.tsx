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
      <strong>Momenmu, pilihanmu.</strong> Foto asli berada di memori browser.
      Download PNG lokal tersedia tanpa upload. Saat membuat preview/download
      MP4 atau menyimpan hasil, foto yang sudah diedit dikirim ke server untuk
      pemrosesan video sementara, lalu file sementara dihapus setelah proses
      selesai/gagal. Jika kamu memilih simpan ke Drive pengelola, kolase PNG dan
      video MP4 masuk ke satu folder hasil yang dapat dibuka siapa saja yang
      punya link dan tetap tersimpan setelah tab ditutup. QR dan foto di halaman
      ini hilang saat refresh. Hubungi pengelola acara untuk penghapusan.
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
