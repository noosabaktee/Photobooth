import Link from "next/link";
import { ArrowRight, Camera, Heart, Sparkles, ScanLine } from "lucide-react";
import { Header } from "@/components/shared";
import { KioskFooter } from "@/components/kiosk";
import { Gallery } from "@/components/gallery";
import { Button } from "@/components/ui/button";
import { dummyPhoto } from "@/lib/compositor";
function PaperStrip({ side }: { side: "left" | "right" }) {
  return (
    <div className={`paper-strip strip-${side}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div className="illustration-photo" key={i}>
          <img src={dummyPhoto(i + (side === "right" ? 3 : 0))} alt="" />
        </div>
      ))}
      <span>little moments ♡</span>
    </div>
  );
}
export function Landing({ view }: { view: "home" | "how" | "frames" }) {
  return (
    <div className="kiosk-shell landing-shell">
      <Header />
      <main className="landing-main">
        {view === "home" && (
          <>
            <section className="hero">
              <div className="hero-grain" />
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <PaperStrip side="left" />
              <PaperStrip side="right" />
              <div className="hero-content">
                <div className="eyebrow">
                  <span className="live-dot" /> YOUR EVERYDAY MEMORY MAKER
                </div>
                <h1>
                  Good company.
                  <br />
                  Silly poses.
                  <br />
                  <em>Great memories.</em>
                </h1>
                <p>
                  Satu layar, sejuta cerita. Masuk ke photo booth kecilmu,
                  <br className="desktop-break" /> ajak orang tersayang, dan
                  biarkan momennya tinggal.
                </p>
                <Button asChild className="hero-cta">
                  <Link href="/booth">
                    <Camera size={20} /> Start Photobooth{" "}
                    <ArrowRight size={19} />
                  </Link>
                </Button>
                <span className="hero-caption">
                  Tanpa akun. Tanpa ribet. Cukup jadi dirimu.
                </span>
              </div>
              <span className="hero-spark spark-one" aria-hidden="true">
                ✳
              </span>
              <span className="hero-spark spark-two" aria-hidden="true">
                ✧
              </span>
              <div className="hero-sticker">
                <Heart size={19} /> more memories,
                <br />
                less scrolling.
              </div>
              <div className="hero-bottom">
                <span>A SMALL BOOTH FOR BIG FEELINGS</span>
                <Link href="/?view=frames">LIHAT KOLEKSI FRAME ↗</Link>
              </div>
            </section>
          </>
        )}
        {view === "how" && (
          <>
            <section className="how-section section-wrap" id="how">
              <div className="section-intro">
                <p className="eyebrow">READY, SET, MAKE A MEMORY</p>
                <h2>
                  Tiga langkah.
                  <br /> <em>Banyak cerita.</em>
                </h2>
                <p>
                  Tidak perlu menunggu acara spesial.
                  <br />
                  Hari ini juga layak diabadikan.
                </p>
              </div>
              <div className="how-steps">
                {[
                  {
                    icon: Sparkles,
                    title: "Pilih yang kamu banget",
                    text: "Pastel manis atau vintage klasik? Temukan frame favoritmu.",
                  },
                  {
                    icon: Camera,
                    title: "Pose. Ketawa. Jepret.",
                    text: "Ikuti hitungan mundur. Kurang pas? Ulangi foto sesukamu.",
                  },
                  {
                    icon: ScanLine,
                    title: "Bawa pulang momennya",
                    text: "Download langsung, atau simpan ke Drive dan scan QR di HP.",
                  },
                ].map((item, i) => (
                  <div className="how-card" key={item.title}>
                    <span className="how-number">0{i + 1}</span>
                    <item.icon size={28} />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>
            <Button asChild className="how-cta">
              <Link href="/booth">
                <Camera size={18} /> Mulai foto sekarang
              </Link>
            </Button>
          </>
        )}
        {view === "frames" && (
          <section id="frames" className="collections section-wrap">
            <div className="section-heading">
              <div>
                <p className="eyebrow">A FRAME FOR EVERY FEELING</p>
                <h2>
                  Pick your <em>personality.</em>
                </h2>
              </div>
              <span>Dirancang untuk momen yang berkesan. ♡</span>
            </div>
            <Gallery />
          </section>
        )}
      </main>
      <KioskFooter />
    </div>
  );
}
