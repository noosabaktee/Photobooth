import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Heart,
  Sparkles,
  ScanLine,
  Hand,
  Check,
} from "lucide-react";
import { Header } from "@/components/shared";
import { KioskFooter } from "@/components/kiosk";
import { Gallery } from "@/components/gallery";
import { Button } from "@/components/ui/button";
import { dummyPhoto } from "@/lib/compositor";
import { eventIdentity } from "@/lib/event";
function PaperStrip({ side }: { side: "left" | "right" }) {
  return (
    <div className={`paper-strip strip-${side}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div className="illustration-photo" key={i}>
          <img src={dummyPhoto(i + (side === "right" ? 3 : 0))} alt="" />
        </div>
      ))}
      <span>Hoya-Hoya memories ♡</span>
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
                  <span className="live-dot" /> SELF-SERVICE PHOTO CORNER
                </div>
                <h1>
                  Hoya-Hoya
                  <br />
                  <em>Days!</em>
                  <span className="event-headline-tag">
                    {eventIdentity.tagline}
                  </span>
                </h1>
                <p>
                  Ajak timmu. Siapkan pose paling seru.
                  <br className="desktop-break" /> Tinggal ketuk, foto, dan bawa
                  pulang kenangannya!
                </p>
                <Button asChild className="hero-cta">
                  <Link href="/booth">
                    <Hand size={22} /> Mulai foto bareng{" "}
                    <ArrowRight size={19} />
                  </Link>
                </Button>
                <span className="hero-caption service-quick-steps">
                  <span>
                    <Sparkles size={13} /> Pilih frame
                  </span>
                  <span>
                    <Camera size={13} /> 3 jepretan
                  </span>
                  <span>
                    <Check size={13} /> PNG + video
                  </span>
                </span>
              </div>
              <span className="hero-spark spark-one" aria-hidden="true">
                ✳
              </span>
              <span className="hero-spark spark-two" aria-hidden="true">
                ✧
              </span>
              <div className="hero-sticker">
                <Heart size={19} /> satu tim,
                <br />
                banyak senyum!
              </div>
              <div className="hero-bottom">
                <span>HOYA-HOYA DAYS · KMI PHOTOBOOTH</span>
                <Link href="/?view=frames">LIHAT KOLEKSI FRAME ↗</Link>
              </div>
            </section>
          </>
        )}
        {view === "how" && (
          <>
            <section className="how-section section-wrap" id="how">
              <div className="section-intro">
                <p className="eyebrow">HOYA-HOYA DAYS PHOTOBOOTH</p>
                <h2>
                  Tiga langkah.
                  <br /> <em>Banyak cerita.</em>
                </h2>
                <p>
                  Rayakan momen bersama rekan satu tim.
                  <br />
                  Senyum hari ini, cerita untuk nanti.
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
                    text: "Buka kamera, lalu ikuti hitungan untuk tiga jepretan.",
                  },
                  {
                    icon: ScanLine,
                    title: "Bawa pulang momennya",
                    text: "Hasil otomatis disimpan. Scan QR di HP sebelum layar berganti.",
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
                <p className="eyebrow">KOLEKSI HOYA-HOYA DAYS</p>
                <h2>
                  Pilih frame. <em>Rayakan momennya.</em>
                </h2>
              </div>
              <span>Kenangan bersama keluarga besar KMI. ♡</span>
            </div>
            <Gallery />
          </section>
        )}
      </main>
      <KioskFooter />
    </div>
  );
}
