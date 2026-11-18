"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ArrowLeft,
  Download,
  RefreshCw,
  Upload,
  Check,
  Copy,
  ExternalLink,
  FlipHorizontal,
  Square,
} from "lucide-react";
import QRCode from "qrcode";
import { Gallery } from "./gallery";
import { Button } from "./ui/button";
import { KioskMessage } from "./kiosk";
import { requestJson } from "@/lib/client";
import type { PublicFrame } from "@/lib/schema";
import {
  drawComposition,
  exportComposition,
  loadImage,
  replacePhoto,
  type Photo,
  type Filter,
} from "@/lib/compositor";
import { driveViewUrl } from "@/lib/urls";

type Result =
  | { mode: "mock"; message: string }
  | { mode: "google-drive"; viewUrl: string; fileId: string; filename: string };
const labels = ["Pilih frame", "Jepret", "Review & edit", "Hasilmu"];
export function Booth({ mode }: { mode: "mock" | "google-drive" }) {
  const [reviewPanel, setReviewPanel] = useState<"edit" | "save">("edit");
  const [step, setStep] = useState(0),
    [frame, setFrame] = useState<PublicFrame | null>(null),
    [overlay, setOverlay] = useState(""),
    [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState<Filter>("natural"),
    [mirror, setMirror] = useState(true),
    [retake, setRetake] = useState<number | null>(null),
    [countdown, setCountdown] = useState<number | null>(null),
    [shot, setShot] = useState(0);
  const [camera, setCamera] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false),
    [rendered, setRendered] = useState<{ blob: Blob; url: string } | null>(
      null,
    ),
    [result, setResult] = useState<Result | null>(null),
    [qr, setQr] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream | null>(null),
    sequence = useRef(0),
    urls = useRef(new Set<string>()),
    uploadLock = useRef(false),
    selectionLock = useRef(false);
  const remember = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }, []);
  function stop() {
    sequence.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera(false);
    setCountdown(null);
  }
  useEffect(() => {
    const owned = urls.current,
      counter = sequence;
    const onHidden = () => {
      if (document.hidden) {
        sequence.current++;
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        setCamera(false);
        setCountdown(null);
        setBusy("");
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      counter.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      owned.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (
      step !== 2 ||
      !frame ||
      !overlay ||
      photos.length !== frame.slots.length ||
      !canvas.current
    )
      return;
    let active = true;
    const target = document.createElement("canvas");
    void drawComposition(
      target,
      frame,
      overlay,
      photos,
      filter,
      Math.min(frame.dimensions.width, 720),
    )
      .then(() => {
        if (active && canvas.current) {
          canvas.current.width = target.width;
          canvas.current.height = target.height;
          canvas.current.getContext("2d")?.drawImage(target, 0, 0);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [step, frame, overlay, photos, filter]);
  useEffect(() => {
    if (result?.mode !== "google-drive") return;
    const value = driveViewUrl(result.viewUrl, result.fileId);
    if (!value) return;
    let active = true;
    void QRCode.toDataURL(value, {
      width: 280,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#183d38", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() =>
        setError("QR tidak dapat dibuat. Gunakan tombol salin link."),
      );
    return () => {
      active = false;
    };
  }, [result]);
  const select = useCallback(
    async (selected: PublicFrame) => {
      if (selectionLock.current) return;
      selectionLock.current = true;
      setBusy("Memuat overlay…");
      setError("");
      try {
        const response = await fetch(selected.overlayUrl, {
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error("Frame berubah atau jaringan terputus. Pilih lagi.");
        const blob = await response.blob();
        const url = remember(blob);
        await loadImage(url);
        setOverlay(url);
        setFrame(selected);
        setPhotos([]);
        setStep(1);
        setRendered(null);
        setResult(null);
        setConsent(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        selectionLock.current = false;
        setBusy("");
      }
    },
    [remember],
  );
  // Landing frame links preserve selection intent without persisting any photo/session data.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("frame");
    if (!id) return;
    let active = true;
    void requestJson<{ frame: PublicFrame }>(
      `/api/frames/${encodeURIComponent(id)}`,
    )
      .then((r) => {
        if (active) void select(r.frame);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [select]);
  async function openCamera(deviceId = device) {
    stop();
    setError("");
    setBusy("Menyiapkan kamera…");
    const attempt = sequence.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Kamera memerlukan HTTPS atau localhost dan browser yang mendukung akses kamera.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: "user" }),
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      });
      if (attempt !== sequence.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      setCamera(true);
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch (e) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setCamera(false);
      const err = e as Error;
      setError(
        err.name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, lalu klik Buka kamera lagi."
          : err.message ||
              "Kamera tidak tersedia. Periksa sambungan kamera, tutup aplikasi lain yang memakainya, lalu coba lagi.",
      );
    } finally {
      setBusy("");
    }
  }
  async function capture() {
    if (!frame || !camera || busy) return;
    const run = ++sequence.current;
    setBusy("Mengambil foto…");
    setError("");
    let next = [...photos];
    const targets =
      retake === null
        ? Array.from({ length: frame.slots.length }, (_, i) => i)
        : [retake];
    try {
      for (const index of targets) {
        setShot(index);
        for (let c = 3; c >= 1; c--) {
          if (run !== sequence.current) return;
          setCountdown(c);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        if (run !== sequence.current) return;
        setCountdown(null);
        const v = video.current;
        if (!v?.videoWidth)
          throw new Error("Kamera belum siap. Buka kembali kamera.");
        const c = document.createElement("canvas");
        const scale = Math.min(1, 1920 / v.videoWidth);
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          c.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Capture gagal."))),
            "image/jpeg",
            0.94,
          ),
        );
        if (run !== sequence.current) return;
        const photo = { url: remember(blob), mirror };
        if (index < next.length) next = replacePhoto(next, index, photo);
        else next.push(photo);
        setPhotos([...next]);
        setRendered(null);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      if (run !== sequence.current) return;
      stop();
      setRetake(null);
      setStep(2);
      setConsent(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (run === sequence.current || !stream.current) {
        setBusy("");
        setCountdown(null);
      }
    }
  }
  async function render() {
    if (rendered) return rendered;
    if (!frame) throw new Error("Pilih frame dahulu.");
    const blob = await exportComposition(frame, overlay, photos, filter);
    const value = { blob, url: remember(blob) };
    setRendered(value);
    return value;
  }
  async function download() {
    setBusy("Membuat PNG resolusi penuh…");
    setError("");
    try {
      const output = await render();
      const a = document.createElement("a");
      a.href = output.url;
      a.download = "snapstrip-memory.png";
      a.click();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function save() {
    if (!consent || uploadLock.current) return;
    uploadLock.current = true;
    setBusy("Membuat hasil & mengunggah…");
    setError("");
    try {
      const output = await render();
      if (output.blob.size > 12 * 1024 * 1024)
        throw new Error(
          "PNG melebihi batas 12 MB. Download lokal atau gunakan frame resolusi lebih kecil.",
        );
      const form = new FormData();
      form.set("photo", output.blob, "final.png");
      form.set("consent", "true");
      form.set("templateId", frame!.id);
      const response = await requestJson<Result>("/api/photos", {
        method: "POST",
        body: form,
      });
      if (
        response.mode !== "mock" &&
        (response.mode !== "google-drive" ||
          !driveViewUrl(response.viewUrl, response.fileId))
      )
        throw new Error("Link Drive tidak valid. Download hasil lokal.");
      setResult(response);
      setStep(3);
    } catch (e) {
      setError(
        `${(e as Error).message} Hasil masih tersedia selama halaman terbuka. Jika respons terputus setelah upload, retry mungkin membuat file tambahan.`,
      );
    } finally {
      uploadLock.current = false;
      setBusy("");
    }
  }
  function startRetake(index: number | null) {
    setReviewPanel("edit");
    stop();
    setRetake(index);
    setStep(1);
    setError("");
    setRendered(null);
    setConsent(false);
  }
  function reset() {
    setReviewPanel("edit");
    stop();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setPhotos([]);
    setFrame(null);
    setOverlay("");
    setRendered(null);
    setResult(null);
    setQr("");
    setConsent(false);
    setRetake(null);
    setStep(0);
    setError("");
    setNotice("");
    setFilter("natural");
    window.history.replaceState(null, "", "/booth");
  }
  return (
    <section className="booth-session" data-step={step}>
      <ol className="stepper" aria-label="Tahap photobooth">
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={step === i ? "step" : undefined}
            className={step === i ? "current" : step > i ? "done" : ""}
          >
            <span>{step > i ? <Check size={15} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="booth-heading">
        <p className="eyebrow">YOUR LITTLE CREATIVE CORNER</p>
        <h1>
          {
            [
              "Temukan frame favoritmu.",
              "Okay, give us your best pose.",
              "Sedikit sentuhan, banyak kenangan.",
              "A little moment, yours to keep.",
            ][step]
          }
        </h1>
        <p>
          {step === 0
            ? "Pilih suasana. Kami siapkan tempat untuk ceritamu."
            : frame
              ? `${frame.name} · ${frame.slots.length} foto · ${frame.dimensions.width} × ${frame.dimensions.height} px`
              : ""}
        </p>
      </div>
      {mode === "mock" && (
        <p className="demo-label">
          DEMO · Download lokal tersedia. Tanpa upload Drive / QR.
        </p>
      )}
      {error && (
        <KioskMessage message={error} error onDismiss={() => setError("")} />
      )}
      {notice && !error && (
        <KioskMessage message={notice} onDismiss={() => setNotice("")} />
      )}
      {busy && (
        <p className="busy" role="status">
          <span className="spinner" />
          {busy}
        </p>
      )}
      <div className="booth-workspace">
        {step === 0 && (
          <Gallery onSelect={(f) => void select(f)} disabled={!!busy} />
        )}
        {step === 1 && frame && (
          <div className="capture-layout">
            <section className="camera-panel">
              <div className="camera-viewport">
                <video
                  ref={video}
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: mirror ? "scaleX(-1)" : "none" }}
                  aria-label="Preview kamera"
                />
                {!camera && (
                  <div className="camera-placeholder">
                    <Camera size={54} />
                    <h2>Halo, calon kenangan! ♡</h2>
                    <p>Aktifkan kamera saat kamu siap.</p>
                  </div>
                )}
                {countdown !== null && (
                  <div
                    className="countdown"
                    role="status"
                    aria-live="assertive"
                  >
                    {countdown}
                  </div>
                )}
                <span className="camera-corner top-left" />
                <span className="camera-corner bottom-right" />
              </div>
              <div className="camera-toolbar">
                <span className="eyebrow">
                  {retake === null
                    ? `FOTO ${Math.min(shot + 1, frame.slots.length)} / ${frame.slots.length}`
                    : `ULANG FOTO ${retake + 1}`}
                </span>
                <Button
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => setMirror((v) => !v)}
                  aria-pressed={mirror}
                >
                  <FlipHorizontal size={18} /> Mirror {mirror ? "on" : "off"}
                </Button>
              </div>
              <div className="camera-actions">
                {camera ? (
                  <>
                    <Button onClick={() => void capture()} disabled={!!busy}>
                      <Camera size={19} />
                      {retake === null ? "Mulai countdown" : "Ambil ulang foto"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        stop();
                        setBusy("");
                      }}
                    >
                      <Square size={17} /> Stop
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => void openCamera()} disabled={!!busy}>
                    <Camera size={19} /> Buka kamera
                  </Button>
                )}
              </div>
              {devices.length > 1 && (
                <label className="field">
                  Pilih kamera
                  <select
                    value={device}
                    disabled={!!busy}
                    onChange={(e) => {
                      setDevice(e.target.value);
                      void openCamera(e.target.value);
                    }}
                  >
                    <option value="">Kamera depan</option>
                    {devices.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Kamera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
            <aside className="capture-sidebar">
              <h2>Make yourself a memory.</h2>
              <p>
                Hitungan 3 detik untuk setiap foto. Santai, kamu bisa ulang
                nanti.
              </p>
              <div
                className="capture-thumbs"
                aria-label="Preview jepretan"
                style={
                  frame.slots.length === 3
                    ? { gridTemplateColumns: "repeat(3,minmax(0,1fr))" }
                    : undefined
                }
              >
                {frame.slots.map((s, i) => (
                  <div
                    key={s.id}
                    className={i === shot ? "active" : ""}
                    aria-label={`Jepretan ${i + 1}${photos[i] ? " selesai" : " belum diambil"}`}
                  >
                    {photos[i] ? (
                      <img
                        src={photos[i].url}
                        alt={`Foto ${i + 1}`}
                        style={{
                          transform: photos[i].mirror ? "scaleX(-1)" : "none",
                        }}
                      />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="small">
                Kamera memerlukan HTTPS atau localhost. Foto asli tetap di
                browser.
              </p>
              {photos.length === frame.slots.length && (
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => {
                    stop();
                    setStep(2);
                  }}
                >
                  Kembali ke review
                </Button>
              )}
              <Button variant="ghost" disabled={!!busy} onClick={reset}>
                <ArrowLeft size={17} /> Ganti frame
              </Button>
            </aside>
          </div>
        )}
        {step === 2 && frame && (
          <div className="review-layout">
            <div className="composition-stage">
              <canvas ref={canvas} aria-label="Preview hasil photo strip" />
            </div>
            <section className="review-controls">
              <p className="eyebrow">THE FINAL LITTLE DETAILS</p>
              <h2>Looks like a keeper.</h2>
              <p>
                Pilih filter, cek tiap jepretan, lalu bawa pulang ceritanya.
              </p>
              <div className="review-tabs" aria-label="Panel review">
                <button
                  aria-pressed={reviewPanel === "edit"}
                  disabled={!!busy}
                  onClick={() => setReviewPanel("edit")}
                >
                  Edit foto
                </button>
                <button
                  aria-pressed={reviewPanel === "save"}
                  disabled={!!busy}
                  onClick={() => setReviewPanel("save")}
                >
                  Simpan & bagikan
                </button>
              </div>
              {reviewPanel === "edit" ? (
                <div className="review-editor">
                  <fieldset className="filter-fieldset" disabled={!!busy}>
                    <legend>Nuansa foto</legend>
                    <div className="filter-options">
                      {(["natural", "bw", "warm", "cool"] as Filter[]).map(
                        (f) => (
                          <button
                            key={f}
                            onClick={() => {
                              setFilter(f);
                              setRendered(null);
                              setConsent(false);
                            }}
                            aria-pressed={filter === f}
                          >
                            {
                              {
                                natural: "Natural",
                                bw: "B&W",
                                warm: "Warm",
                                cool: "Cool",
                              }[f]
                            }
                          </button>
                        ),
                      )}
                    </div>
                  </fieldset>
                  <div
                    className="retake-grid"
                    style={{
                      gridTemplateColumns: `repeat(${photos.length},minmax(0,1fr))`,
                    }}
                  >
                    {photos.map((p, i) => (
                      <button
                        key={i}
                        disabled={!!busy}
                        onClick={() => startRetake(i)}
                        aria-label={`Ulang foto ${i + 1}`}
                      >
                        <img
                          src={p.url}
                          alt={`Foto ${i + 1}`}
                          style={{
                            transform: p.mirror ? "scaleX(-1)" : "none",
                          }}
                        />
                        <span>
                          <RefreshCw size={12} /> Ulang {i + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() => startRetake(null)}
                    >
                      <RefreshCw size={16} /> Ulang semua
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() => {
                        setPhotos((p) =>
                          p.map((photo) => ({
                            ...photo,
                            mirror: !photo.mirror,
                          })),
                        );
                        setRendered(null);
                        setConsent(false);
                      }}
                    >
                      <FlipHorizontal size={17} /> Balik foto
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="review-save">
                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={!!busy}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      Saya setuju hasil disimpan ke Google Drive pengelola dan
                      dapat dilihat siapa saja yang memiliki link. Foto di Drive
                      tidak otomatis terhapus saat tab ditutup.
                    </span>
                  </label>
                  <Button
                    disabled={!consent || !!busy}
                    onClick={() => void save()}
                  >
                    <Upload size={18} /> Simpan ke Drive & buat QR
                  </Button>
                  <p className="small">
                    Mode demo akan menampilkan konfirmasi demo tanpa QR atau
                    penyimpanan Drive.
                  </p>
                </div>
              )}
              <div className="review-download">
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => void download()}
                >
                  <Download size={18} /> Download PNG lokal
                </Button>
                {reviewPanel === "edit" && (
                  <Button
                    disabled={!!busy}
                    onClick={() => setReviewPanel("save")}
                  >
                    Lanjut simpan →
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}
        {step === 3 && result && rendered && (
          <div className="result-layout">
            <div className="composition-stage">
              <img src={rendered.url} alt="Hasil akhir photo strip" />
            </div>
            <section className="result-card">
              <span className="success-icon">
                <Check size={24} />
              </span>
              <h2>
                {result.mode === "mock"
                  ? "Demo selesai. Momennya tetap milikmu."
                  : "Hasilmu sudah siap!"}
              </h2>
              {result.mode === "mock" ? (
                <p className="demo-label">
                  {result.message} Tidak ada QR atau link Drive pada mode demo.
                </p>
              ) : (
                <>
                  <p>Scan QR ini dengan kamera HP.</p>
                  {qr && (
                    <img
                      className="qr"
                      src={qr}
                      width={280}
                      height={280}
                      alt="QR link Google Drive hasil foto"
                    />
                  )}
                  <div className="inline-actions">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(result.viewUrl)
                          .then(() => setNotice("Link tersalin."))
                          .catch(() =>
                            setError(
                              "Tidak dapat menyalin. Gunakan tombol Open in Drive.",
                            ),
                          );
                      }}
                    >
                      <Copy size={17} /> Copy link
                    </Button>
                    <Button asChild>
                      <a
                        href={result.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={17} /> Open in Drive
                      </a>
                    </Button>
                  </div>
                </>
              )}
              <div className="result-downloads">
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => void download()}
                >
                  <Download size={18} /> Download lokal
                </Button>
                <Button variant="ghost" disabled={!!busy} onClick={reset}>
                  <RefreshCw size={17} /> Take another
                </Button>
              </div>
              <p className="small">
                Simpan sebelum keluar. QR hilang saat refresh; foto yang sudah
                di-upload tetap ada di Drive.
              </p>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
