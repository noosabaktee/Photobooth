"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicFrame } from "@/lib/schema";
import { requestJson } from "@/lib/client";
import { Button } from "./ui/button";
const portraitQuery = "(max-width: 600px) and (orientation: portrait)";
function subscribeSize(callback: () => void) {
  const media = window.matchMedia(portraitQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function pageSize() {
  return window.matchMedia(portraitQuery).matches ? 2 : 3;
}
export function Gallery({
  onSelect,
  disabled = false,
}: {
  onSelect?: (frame: PublicFrame) => void;
  disabled?: boolean;
}) {
  const [frames, setFrames] = useState<PublicFrame[]>([]),
    [mode, setMode] = useState(""),
    [theme, setTheme] = useState("all"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(0);
  const perPage = useSyncExternalStore(subscribeSize, pageSize, () => 3);
  const filtered = frames.filter(
    (f) => theme === "all" || f.category === theme,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * perPage, (current + 1) * perPage);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await requestJson<{ frames: PublicFrame[]; mode: string }>(
        "/api/frames",
      );
      setFrames(result.frames);
      setMode(result.mode);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void requestJson<{ frames: PublicFrame[]; mode: string }>("/api/frames")
      .then((result) => {
        if (active) {
          setFrames(result.frames);
          setMode(result.mode);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="gallery-panel">
      <div className="gallery-toolbar">
        <label className="gallery-filter">
          Tema
          <select
            aria-label="Filter tema"
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              setPage(0);
            }}
          >
            {["all", ...new Set(frames.map((f) => f.category))].map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "Semua frame" : t}
              </option>
            ))}
          </select>
        </label>
        {mode === "mock" && (
          <span className="gallery-demo">DEMO · frame lokal</span>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error} <button onClick={() => void load()}>Coba lagi</button>
        </div>
      )}
      {loading && (
        <div className="gallery-grid" aria-label="Memuat frame">
          {Array.from({ length: perPage }, (_, i) => i).map((i) => (
            <div className="skeleton frame-skeleton" key={i} />
          ))}
        </div>
      )}
      {!loading && !error && !frames.length && (
        <div className="empty">
          Belum ada frame yang dipublish. Pengelola dapat menambahkan frame di
          panel admin.
        </div>
      )}
      {!loading && (
        <div className="gallery-grid">
          {visible.map((frame, i) => {
            const content = (
              <>
                <span className="frame-stage">
                  <span className="frame-index">0{i + 1}</span>
                  {frame.thumbnailUrl ? (
                    <img
                      src={frame.thumbnailUrl}
                      alt={`Preview ${frame.name}`}
                      loading="lazy"
                    />
                  ) : (
                    <Layers size={60} />
                  )}
                  <span className="shot-badge">
                    {frame.slots.length} jepretan
                  </span>
                </span>
                <span className="frame-caption">
                  <span>
                    <span className="frame-category">
                      {frame.category} collection
                    </span>
                    <span className="frame-title">{frame.name}</span>
                  </span>
                  <span className="frame-arrow" aria-hidden="true">
                    <ArrowUpRight size={20} />
                  </span>
                </span>
              </>
            );
            return (
              <article
                className={`frame-card frame-color-${i % 3}`}
                key={frame.id}
              >
                {onSelect ? (
                  <button
                    className="frame-choice"
                    type="button"
                    aria-label={`Pilih ${frame.name}`}
                    disabled={disabled}
                    onClick={() => onSelect(frame)}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    className="frame-choice"
                    href={`/booth?frame=${frame.id}`}
                    aria-label={`Pilih ${frame.name}`}
                  >
                    {content}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
      {!loading && frames.length > 0 && (
        <nav className="gallery-pagination" aria-label="Halaman koleksi frame">
          <Button
            variant="secondary"
            aria-label="Frame sebelumnya"
            disabled={current === 0 || disabled}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <span aria-live="polite">
            {current + 1} / {pages} · {filtered.length} frame
          </span>
          <Button
            variant="secondary"
            aria-label="Frame berikutnya"
            disabled={current >= pages - 1 || disabled}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </nav>
      )}
    </div>
  );
}
