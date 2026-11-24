"use client";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  Camera,
  Download,
  Upload,
  Timer,
  Check,
  Copy,
  ExternalLink,
  FlipHorizontal,
  Square,
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "./ui/button";
import { KioskMessage } from "./kiosk";
import { CaptureCountdown, Celebration, NextGuestButton } from "./self-service";
import { requestJson } from "@/lib/client";
import type { PublicFrame } from "@/lib/schema";
import {
  exportComposition,
  exportBoomerangFrames,
  loadImage,
  type Photo,
} from "@/lib/compositor";
import { driveFolderUrl } from "@/lib/urls";
import { eventIdentity } from "@/lib/event";
import { scanSecondsSchema } from "@/lib/kiosk-settings";
import { exportPrintPreview } from "@/lib/print-preview-client";
import { selectedStarterStyle } from "@/lib/starter-artwork";

type Result =
  | { mode: "mock"; message: string }
  | {
      mode: "google-drive";
      viewUrl: string;
      folderId: string;
      folderName: string;
      photoDataUrl: string;
      videoDataUrl: string;
      files: { fileId: string; filename: string; mimeType: string }[];
    };
const labels = ["Ambil foto", "Simpan otomatis", "Scan QR"];
export function Booth({ mode }: { mode: "mock" | "google-drive" }) {
  const composition = useRef<{ blob: Blob; url: string } | null>(null);
  const [movie, setMovie] = useState<{ blob: Blob; url: string } | null>(null);
  const [preview, setPreview] = useState<"photo" | "video">("photo");
  const [scanSeconds, setScanSeconds] = useState(15);
  const [qrReady, setQrReady] = useState(false);
  const [remaining, setRemaining] = useState(15);
  const resetRef = useRef<() => void>(() => {});
  const [step, setStep] = useState(0),
    [frame, setFrame] = useState<PublicFrame | null>(null),
    [overlay, setOverlay] = useState(""),
    [photos, setPhotos] = useState<Photo[]>([]);
  const [mirror, setMirror] = useState(true),
    [countdown, setCountdown] = useState<number | null>(null),
    [shot, setShot] = useState(0);
  const [camera, setCamera] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [busy, setBusy] = useState("Memuat template booth..."),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [rendered, setRendered] = useState<{ blob: Blob; url: string } | null>(
      null,
    ),
    [result, setResult] = useState<Result | null>(null),
    [qr, setQr] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    sequence = useRef(0),
    urls = useRef(new Set<string>()),
    uploadLock = useRef(false);
  const network = useRef<AbortController | null>(null);
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
        // Async operations clear their own busy state in finally. Hiding the tab
        // must not unlock edits while video rendering or Drive upload is pending.
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      network.current?.abort();
      document.removeEventListener("visibilitychange", onHidden);
      counter.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      owned.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (step !== 3 || !result || (result.mode === "google-drive" && !qrReady))
      return;
    const deadline = Date.now() + scanSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) resetRef.current();
    };
    const interval = window.setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [step, result, qrReady, scanSeconds]);
  useEffect(() => {
    if (result?.mode !== "google-drive") return;
    const value = driveFolderUrl(result.viewUrl, result.folderId);
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
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const settings = await requestJson<{
          scanSeconds: number;
          frame: PublicFrame;
        }>("/api/settings", { signal: controller.signal });
        const duration = scanSecondsSchema.parse(settings.scanSeconds);
        const selected = settings.frame;
        const response = await fetch(selected.overlayUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "Template tidak dapat dimuat. Hubungi pengelola atau coba lagi.",
          );
        const blob = await response.blob();
        const url = remember(blob);
        await loadImage(url);
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        setScanSeconds(duration);
        setRemaining(duration);
        setOverlay(url);
        setFrame(selected);
        setStep(1);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setBusy("");
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [remember]);
  const autoOpenCamera = useEffectEvent(() => {
    void openCamera();
  });
  useEffect(() => {
    if (!frame || window.history.state?.photoboothNextGuest !== true) return;
    // A one-shot continuation of a completed session, never photo/QR storage.
    window.history.replaceState(
      { ...window.history.state, photoboothNextGuest: false },
      "",
    );
    autoOpenCamera();
  }, [frame]);
  async function openCamera(deviceId = device) {
    if (busy) return;
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
    const next = [...photos];
    const targets = Array.from({ length: frame.slots.length }, (_, i) => i);
    try {
      for (const index of targets) {
        setShot(index);
        for (let c = 3; c >= 1; c--) {
          if (run !== sequence.current) return;
          setCountdown(c);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        if (run !== sequence.current) return;
        setCountdown(0);
        await new Promise((resolve) => setTimeout(resolve, 500));
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
        next[index] = photo;
        setPhotos([...next]);
        setRendered(null);
        composition.current = null;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      if (run !== sequence.current) return;
      stop();
      setStep(2);
      await save(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (run === sequence.current || !stream.current) {
        setBusy("");
        setCountdown(null);
      }
    }
  }
  function localDownload(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  async function save(captured = photos) {
    if (uploadLock.current || !frame || captured.length !== frame.slots.length)
      return;
    uploadLock.current = true;
    setStep(2);
    setBusy("Menyiapkan kolase...");
    setError("");
    try {
      const printLayout = {
        dimensions: frame.dimensions,
        starterStyle: selectedStarterStyle(frame),
        photoBottom: Math.min(
          frame.dimensions.height,
          Math.ceil(
            Math.max(...frame.slots.map((s) => s.y + s.height)) *
              frame.dimensions.height,
          ),
        ),
      };
      let output = composition.current;
      if (!output) {
        const blob = await exportComposition(
          frame,
          overlay,
          captured,
          "natural",
        );
        output = { blob, url: remember(blob) };
        composition.current = output;
      }
      if (!rendered) {
        const blob = await exportPrintPreview(output.url, printLayout);
        setRendered({ blob, url: remember(blob) });
      }
      if (output.blob.size > 12 * 1024 * 1024)
        throw new Error(
          "PNG melebihi batas 12 MB. Download lokal atau gunakan frame lebih kecil.",
        );
      let videoOutput = movie;
      if (!videoOutput) {
        setBusy("Membuat video 6 detik...");
        const images = await exportBoomerangFrames(frame, captured, "natural");
        const videoForm = new FormData();
        images.forEach((image, i) =>
          videoForm.append("frames", image, `pose-${i}.jpg`),
        );
        videoForm.set("processingConsent", "true");
        network.current = new AbortController();
        const response = await fetch("/api/boomerang", {
          method: "POST",
          body: videoForm,
          cache: "no-store",
          signal: network.current.signal,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.error?.message || "Video gagal dibuat. Coba lagi.",
          );
        }
        const blob = await response.blob();
        if (blob.type !== "video/mp4")
          throw new Error("Format video tidak valid.");
        videoOutput = { blob, url: remember(blob) };
        setMovie(videoOutput);
      }
      setBusy(
        mode === "mock"
          ? "Memvalidasi kolase + video demo..."
          : "Mengirim kolase + video ke Drive...",
      );
      const form = new FormData();
      form.set("photo", output.blob, "final.png");
      form.set("video", videoOutput.blob, "boomerang.mp4");
      form.set("consent", "true");
      form.set("printLayout", JSON.stringify(printLayout));
      network.current = new AbortController();
      const response = await requestJson<Result>("/api/photos", {
        method: "POST",
        body: form,
        signal: network.current.signal,
      });
      if (response.mode === "google-drive") {
        if (
          !driveFolderUrl(response.viewUrl, response.folderId) ||
          !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(
            response.photoDataUrl,
          ) ||
          response.photoDataUrl.length > 17 * 1024 * 1024 ||
          typeof response.videoDataUrl !== "string" ||
          !/^data:video\/mp4;base64,[A-Za-z0-9+/=]+$/.test(
            response.videoDataUrl,
          ) ||
          response.videoDataUrl.length > 23 * 1024 * 1024
        )
          throw new Error(
            "Hasil atau link Drive tidak valid. Download lokal atau hubungi operator.",
          );
        const data = atob(response.photoDataUrl.split(",")[1]);
        const blob = new Blob([Uint8Array.from(data, (c) => c.charCodeAt(0))], {
          type: "image/png",
        });
        const url = remember(blob);
        await loadImage(url);
        const videoData = atob(response.videoDataUrl.split(",")[1]);
        const videoBytes = Uint8Array.from(videoData, (c) => c.charCodeAt(0));
        if (
          videoBytes.length > 16 * 1024 * 1024 ||
          String.fromCharCode(...videoBytes.slice(4, 8)) !== "ftyp"
        )
          throw new Error("Video final tidak valid.");
        const finalMovie = new Blob([videoBytes], { type: "video/mp4" });
        setRendered({ blob, url });
        setMovie({ blob: finalMovie, url: remember(finalMovie) });
      } else if (response.mode !== "mock")
        throw new Error("Respons penyimpanan tidak valid.");
      setQrReady(false);
      setRemaining(scanSeconds);
      setResult(response);
      setStep(3);
    } catch (e) {
      setError(
        `${(e as Error).message} Hasil tetap tersedia. Retry setelah respons terputus mungkin membuat folder tambahan.`,
      );
    } finally {
      uploadLock.current = false;
      setBusy("");
    }
  }
  function reset() {
    stop();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setPhotos([]);
    setShot(0);
    setMirror(true);
    setFrame(null);
    setOverlay("");
    setRendered(null);
    composition.current = null;
    setMovie(null);
    setPreview("photo");
    setResult(null);
    setQr("");
    setQrReady(false);
    setRemaining(scanSeconds);
    setStep(0);
    setError("");
    setNotice("");
    window.history.replaceState(
      { ...window.history.state, photoboothNextGuest: step === 3 },
      "",
      "/booth",
    );
    window.location.reload();
  }
  useEffect(() => {
    resetRef.current = reset;
  });
  return (
    <section className="booth-session" data-step={step}>
      <ol className="stepper" aria-label="Tahap photobooth">
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={step === i + 1 ? "step" : undefined}
            className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
          >
            <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="booth-heading" key={step}>
        <p className="eyebrow">{eventIdentity.name} · KMI PHOTOBOOTH</p>
        <h1>
          {
            [
              "Menyiapkan booth...",
              "Satu tim, pose paling seru!",
              "Menyimpan momenmu...",
              "Kenangan Hoya-Hoya, untuk dibawa pulang.",
            ][step]
          }
        </h1>
        <p>
          {step === 0
            ? "Template acara sedang disiapkan. Tunggu sebentar, ya."
            : step === 1
              ? camera
                ? "Posisikan diri, lalu ketuk Mulai countdown. Foto diambil otomatis."
                : "Ketuk Buka kamera untuk memulai, lalu izinkan akses kamera di browser."
              : step === 2
                ? "Kolase dan video otomatis diproses. Tunggu sampai QR tampil."
                : "Scan QR sekarang. Layar akan kembali otomatis untuk sesi berikutnya."}
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
        <p
          className={`busy ${step === 1 ? "camera-status" : ""}`}
          role="status"
        >
          <span className="spinner" />
          {busy}
        </p>
      )}
      <div className="booth-workspace">
        {step === 3 && result && <Celebration />}
        {step === 0 && !busy && (
          <div className="auto-upload-card">
            <h2>Booth belum siap</h2>
            <p>Hubungi pengelola untuk memeriksa template dan jaringan.</p>
            <Button onClick={reset}>Coba lagi</Button>
          </div>
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
                    <span className="camera-welcome-icon">
                      <Camera size={44} />
                    </span>
                    <h2>Halo, calon kenangan! ♡</h2>
                    <p>
                      Rekan satu tim sudah siap? Ketuk Buka kamera di bawah.
                    </p>
                  </div>
                )}
                {camera && countdown === null && !busy && (
                  <span className="camera-ready-badge">
                    <span />
                    Kamera siap · waktunya berpose!
                  </span>
                )}
                {countdown !== null && (
                  <CaptureCountdown
                    value={countdown}
                    shot={shot}
                    total={frame.slots.length}
                  />
                )}
                {camera && countdown === null && !busy && (
                  <span className="camera-position-hint">
                    Lihat kamera, rapatkan barisan, dan senyum!
                  </span>
                )}
                <span className="camera-corner top-left" />
                <span className="camera-corner bottom-right" />
              </div>
              <div className="camera-toolbar">
                <span className="eyebrow">
                  {`FOTO ${Math.min(shot + 1, frame.slots.length)} / ${frame.slots.length}`}
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
                      {busy ? "Sedang foto…" : "Mulai countdown"}
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
                    <Camera size={19} />
                    {busy ? "Menyiapkan kamera…" : "Buka kamera"}
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
              <h2>Senyum bareng, Hoya-Hoya!</h2>
              <p>
                Hitungan 3 detik untuk setiap foto, lalu jeda setengah detik.
                Hasil langsung disimpan otomatis.
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
                    className={`${i === shot ? "active" : ""} ${photos[i] ? "captured" : ""}`}
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
                    {photos[i] && (
                      <span className="capture-done" aria-hidden="true">
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="small">
                Setelah foto terakhir, tunggu QR tampil lalu scan dengan HP.
                Tidak ada pilihan filter.
              </p>
              <p className="small">
                Template acara: {frame.name}. Disiapkan oleh pengelola.
              </p>
            </aside>
          </div>
        )}
        {step === 2 && frame && (
          <div className="auto-upload-layout">
            {rendered && (
              <img
                className="auto-upload-preview"
                src={rendered.url}
                alt="Kolase menunggu upload"
              />
            )}
            <section className="auto-upload-card">
              <Upload size={32} />
              <h2>
                {busy
                  ? "Sebentar, momennya sedang disimpan."
                  : "Penyimpanan belum selesai."}
              </h2>
              <p>
                {busy ||
                  "Periksa jaringan lalu coba lagi. Hasil belum dihapus."}
              </p>
              {busy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <div className="auto-upload-actions">
                  <Button onClick={() => void save()}>Coba simpan lagi</Button>
                  {rendered && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        localDownload(
                          rendered.url,
                          eventIdentity.downloadFilename,
                        )
                      }
                    >
                      Download PNG lokal
                    </Button>
                  )}
                  {movie && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        localDownload(movie.url, "hoya-hoya-days-kmi-video.mp4")
                      }
                    >
                      Download MP4
                    </Button>
                  )}
                  <NextGuestButton disabled={false} onConfirm={reset} />
                </div>
              )}
              <p className="small">
                Timer scan baru dimulai setelah hasil siap. Jangan refresh saat
                proses berlangsung.
              </p>
            </section>
          </div>
        )}
        {step === 3 && result && rendered && (
          <div className="result-layout">
            <div className="output-preview">
              <div className="output-tabs" aria-label="Jenis preview hasil">
                <button
                  disabled={!!busy}
                  aria-pressed={preview === "photo"}
                  onClick={() => setPreview("photo")}
                >
                  Kolase PNG
                </button>
                <button
                  disabled={!!busy}
                  aria-pressed={preview === "video"}
                  onClick={() => setPreview("video")}
                >
                  Video MP4
                </button>
              </div>
              <div className="composition-stage">
                {preview === "photo" ? (
                  <img src={rendered.url} alt="Hasil akhir photo strip" />
                ) : (
                  movie && (
                    <video
                      src={movie.url}
                      controls
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      aria-label="Preview video MP4"
                    />
                  )
                )}
              </div>
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
                  <p>
                    Arahkan kamera HP ke QR. Kolase PNG + video MP4 ada di satu
                    folder.
                  </p>
                  {qr && (
                    <img
                      className="qr"
                      src={qr}
                      width={280}
                      height={280}
                      alt="QR folder Google Drive kolase dan video"
                      onLoad={() => setQrReady(true)}
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
                              "Tidak dapat menyalin. Gunakan tombol Buka Drive.",
                            ),
                          );
                      }}
                    >
                      <Copy size={17} /> Salin link
                    </Button>
                    <Button asChild>
                      <a
                        href={result.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={17} /> Buka Drive
                      </a>
                    </Button>
                  </div>
                </>
              )}
              <p className="scan-timer" role="timer" aria-live="off">
                <Timer size={18} /> Kembali ke pilih frame dalam{" "}
                <strong>{remaining}</strong> detik
              </p>
              <div className="result-downloads">
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() =>
                    localDownload(rendered.url, eventIdentity.downloadFilename)
                  }
                >
                  <Download size={18} /> PNG
                </Button>
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() =>
                    movie &&
                    localDownload(movie.url, "hoya-hoya-days-kmi-video.mp4")
                  }
                >
                  <Download size={18} /> MP4
                </Button>
                <NextGuestButton disabled={!!busy} onConfirm={reset} />
              </div>
              <p className="small">
                {result.mode === "mock"
                  ? "Unduh hasil demo sebelum layar berganti. Tidak ada file yang disimpan ke Drive."
                  : "Scan sekarang. QR juga ada di PNG untuk dicetak. File di Drive tetap tersimpan setelah layar berganti."}
              </p>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
