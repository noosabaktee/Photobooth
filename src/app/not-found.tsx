import Link from "next/link";
export default function NotFound() {
  return (
    <main className="section-wrap">
      <h1>Halaman tidak ditemukan.</h1>
      <Link href="/">Kembali ke beranda</Link>
    </main>
  );
}
