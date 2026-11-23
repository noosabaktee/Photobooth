"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Save,
  Eye,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "./ui/button";
import type { AdminFrame } from "./admin";
import {
  categories,
  draftSchema,
  layoutSchema,
  type Draft,
  type Slot,
} from "@/lib/schema";
import { requestJson } from "@/lib/client";
import { loadImage } from "@/lib/compositor";

const initial: Draft = {
  name: "",
  category: "pastel",
  tags: [],
  dimensions: { width: 1200, height: 3600 },
  slots: [],
};
const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
export function FrameBuilder({ id }: { id?: string }) {
  const [draft, setDraft] = useState<Draft>(initial),
    [frame, setFrame] = useState<AdminFrame | null>(null),
    [overlay, setOverlay] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [selected, setSelected] = useState(0),
    [preview, setPreview] = useState(false),
    [previewRatio, setPreviewRatio] = useState<number | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(!id);
  const area = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    localUrls = useRef(new Set<string>()),
    drag = useRef<{
      id: string;
      mode: "move" | "resize";
      x: number;
      y: number;
      slot: Slot;
      width: number;
      height: number;
    } | null>(null),
    router = useRouter();
  useEffect(() => {
    const owned = localUrls.current;
    return () => owned.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void requestJson<{ frame: AdminFrame }>(`/api/admin/frames/${id}`)
      .then(({ frame }) => {
        if (!active) return;
        setFrame(frame);
        setDraft({
          name: frame.name,
          category: frame.category,
          tags: frame.tags,
          dimensions: frame.dimensions,
          slots: frame.slots,
        });
        setOverlay(frame.overlayUrl);
        setLoaded(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!preview || !overlay || !canvas.current) return;
    let active = true;
    const controller = new AbortController();
    let url: string | undefined;
    void (async () => {
      const form = new FormData();
      if (file) form.set("overlay", file, "overlay.png");
      else {
        const asset = await fetch(overlay, { signal: controller.signal });
        if (!asset.ok) throw new Error("Overlay tidak dapat dimuat.");
        form.set("overlay", await asset.blob(), "overlay.png");
      }
      form.set(
        "metadata",
        JSON.stringify({ ...draft, name: draft.name || "Preview frame" }),
      );
      const response = await fetch("/api/admin/preview", {
        method: "POST",
        body: form,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error?.message || "Preview gagal dibuat.",
        );
      const blob = await response.blob();
      if (!active) return;
      url = URL.createObjectURL(blob);
      const image = await loadImage(url);
      if (active && canvas.current) {
        canvas.current.width = 600;
        canvas.current.height = Math.round(
          (600 * image.naturalHeight) / image.naturalWidth,
        );
        canvas.current
          .getContext("2d")
          ?.drawImage(image, 0, 0, canvas.current.width, canvas.current.height);
        setPreviewRatio(image.naturalWidth / image.naturalHeight);
      }
    })().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview, overlay, draft, file]);
  function updateSlot(changes: Partial<Slot>, index = selected) {
    setDraft((d) => ({
      ...d,
      slots: d.slots.map((slot, i) =>
        i === index ? { ...slot, ...changes } : slot,
      ),
    }));
    setNotice("");
  }
  async function chooseFile(next: File | undefined) {
    if (!next) return;
    setError("");
    if (next.type !== "image/png" || next.size > 8 * 1024 * 1024) {
      setError("Overlay harus PNG transparan, maksimal 8 MB.");
      return;
    }
    try {
      const url = URL.createObjectURL(next);
      localUrls.current.add(url);
      const image = await loadImage(url);
      setDraft((d) => ({
        ...d,
        dimensions: { width: image.naturalWidth, height: image.naturalHeight },
      }));
      setFile(next);
      setOverlay(url);
      setNotice("Dimensi PNG terdeteksi. Atur slot di area transparan.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addSlot() {
    if (draft.slots.length >= 6) return;
    const order = draft.slots.length;
    setDraft((d) => ({
      ...d,
      slots: [
        ...d.slots,
        {
          id: crypto.randomUUID(),
          order,
          x: 0.09,
          y: clamp(0.07 + order * 0.15, 0, 0.85),
          width: 0.82,
          height: 0.13,
          borderRadius: 0,
          cropPosition: { x: 0.5, y: 0.5 },
        },
      ],
    }));
    setSelected(order);
    setPreview(false);
  }
  function reorder(direction: number) {
    const destination = selected + direction;
    if (destination < 0 || destination >= draft.slots.length) return;
    setDraft((d) => {
      const slots = [...d.slots];
      [slots[selected], slots[destination]] = [
        slots[destination],
        slots[selected],
      ];
      return { ...d, slots: slots.map((slot, i) => ({ ...slot, order: i })) };
    });
    setSelected(destination);
  }
  function pointerStart(
    event: React.PointerEvent,
    index: number,
    mode: "move" | "resize",
  ) {
    if (busy || preview || !area.current) return;
    event.preventDefault();
    event.stopPropagation();
    const box = area.current.getBoundingClientRect();
    setSelected(index);
    drag.current = {
      id: draft.slots[index].id,
      mode,
      x: event.clientX,
      y: event.clientY,
      slot: { ...draft.slots[index] },
      width: box.width,
      height: box.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: React.PointerEvent) {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.x) / current.width,
      dy = (event.clientY - current.y) / current.height,
      s = current.slot;
    const change =
      current.mode === "move"
        ? {
            x: clamp(s.x + dx, 0, 1 - s.width),
            y: clamp(s.y + dy, 0, 1 - s.height),
          }
        : {
            width: clamp(s.width + dx, 0.02, 1 - s.x),
            height: clamp(s.height + dy, 0.02, 1 - s.y),
          };
    setDraft((d) => ({
      ...d,
      slots: d.slots.map((slot) =>
        slot.id === current.id ? { ...slot, ...change } : slot,
      ),
    }));
  }
  async function save(publish = false) {
    if (busy || !loaded) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const cleaned = {
        ...draft,
        tags: draft.tags.map((t) => t.trim()).filter(Boolean),
      };
      (publish ? layoutSchema : draftSchema).parse(cleaned);
      const data = new FormData();
      data.set(
        "metadata",
        JSON.stringify({ ...cleaned, expectedRevision: frame?.revision }),
      );
      if (file) data.set("overlay", file);
      const { frame: saved } = await requestJson<{ frame: AdminFrame }>(
        frame ? `/api/admin/frames/${frame.id}` : "/api/admin/frames",
        { method: frame ? "PATCH" : "POST", body: data },
      );
      setFrame(saved);
      setFile(null);
      setOverlay(saved.overlayUrl);
      if (publish) {
        const { frame: published } = await requestJson<{ frame: AdminFrame }>(
          `/api/admin/frames/${saved.id}/publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedRevision: saved.revision }),
          },
        );
        setFrame(published);
        setNotice("Frame dipublish. Sudah tersedia di galeri publik.");
      } else setNotice("Draft tersimpan. Publish untuk menampilkan di galeri.");
      if (!id) router.replace(`/admin/frames/${saved.id}/edit`);
    } catch (e) {
      const err = e as Error & { issues?: { message: string }[] };
      setError(err.issues?.map((i) => i.message).join(" ") || err.message);
    } finally {
      setBusy(false);
    }
  }
  const current = draft.slots[selected];
  const layout = layoutSchema.safeParse(draft);
  return (
    <>
      <div className="admin-topbar">
        <div>
          <Button asChild variant="ghost">
            <Link href="/admin">
              <ArrowLeft size={17} /> Koleksi
            </Link>
          </Button>
          <h1>{id ? "Edit frame" : "Create a little magic."}</h1>
        </div>
        {frame && (
          <span className={`status-pill status-${frame.status}`}>
            {frame.status} · revisi {frame.revision}
          </span>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!loaded && <p role="status">Memuat frame…</p>}
      <div className="builder-layout">
        <section>
          <div className="builder-surface">
            {overlay ? (
              <div
                className="builder-canvas"
                ref={area}
                style={{
                  aspectRatio:
                    preview && previewRatio
                      ? String(previewRatio)
                      : `${draft.dimensions.width}/${draft.dimensions.height}`,
                }}
              >
                {preview ? (
                  <canvas
                    ref={canvas}
                    aria-label="Preview komposisi placeholder"
                  />
                ) : (
                  <>
                    <img src={overlay} alt="PNG overlay yang sedang diedit" />
                    {draft.slots.map((slot, index) => (
                      <div
                        role="button"
                        tabIndex={busy ? -1 : 0}
                        aria-label={`Slot ${index + 1}, gunakan panah untuk geser`}
                        aria-pressed={selected === index}
                        key={slot.id}
                        className={`builder-slot ${selected === index ? "selected" : ""}`}
                        style={{
                          left: `${slot.x * 100}%`,
                          top: `${slot.y * 100}%`,
                          width: `${slot.width * 100}%`,
                          height: `${slot.height * 100}%`,
                          borderRadius: (slot.borderRadius || 0) * 360,
                        }}
                        onFocus={() => setSelected(index)}
                        onPointerDown={(e) => pointerStart(e, index, "move")}
                        onPointerMove={pointerMove}
                        onPointerUp={() => {
                          drag.current = null;
                        }}
                        onPointerCancel={() => {
                          drag.current = null;
                        }}
                        onKeyDown={(e) => {
                          if (busy) return;
                          const amount = e.shiftKey ? 0.01 : 0.001;
                          const directions: Record<
                            string,
                            { x?: number; y?: number }
                          > = {
                            ArrowLeft: {
                              x: clamp(slot.x - amount, 0, 1 - slot.width),
                            },
                            ArrowRight: {
                              x: clamp(slot.x + amount, 0, 1 - slot.width),
                            },
                            ArrowUp: {
                              y: clamp(slot.y - amount, 0, 1 - slot.height),
                            },
                            ArrowDown: {
                              y: clamp(slot.y + amount, 0, 1 - slot.height),
                            },
                          };
                          if (directions[e.key]) {
                            e.preventDefault();
                            updateSlot(directions[e.key], index);
                          }
                        }}
                      >
                        <span>{index + 1}</span>
                        <span
                          className="slot-handle"
                          role="presentation"
                          onPointerDown={(e) =>
                            pointerStart(e, index, "resize")
                          }
                          onPointerMove={pointerMove}
                          onPointerUp={() => {
                            drag.current = null;
                          }}
                          onPointerCancel={() => {
                            drag.current = null;
                          }}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="empty">
                Upload PNG transparan untuk membuka canvas.
              </div>
            )}
          </div>
          <p className="builder-help">
            {draft.dimensions.width} × {draft.dimensions.height} px · Koordinat
            normalized 0–1
            <br />
            Drag slot untuk geser, tarik sudut kanan bawah untuk resize. Panah
            untuk nudge; Shift untuk langkah lebih besar.
          </p>
          <div
            className="inline-actions"
            style={{ justifyContent: "center", marginTop: 15 }}
          >
            <Button
              variant="secondary"
              disabled={!overlay || busy}
              onClick={() => setPreview((v) => !v)}
            >
              <Eye size={17} />
              {preview ? "Kembali ke editor" : "Preview komposisi"}
            </Button>
          </div>
          {preview && (
            <p className="small">
              Contoh hasil akhir. Area QR akan diisi tautan folder setelah sesi
              foto selesai.
            </p>
          )}
          <details style={{ marginTop: 20 }}>
            <summary>JSON konfigurasi</summary>
            <pre className="builder-json">{JSON.stringify(draft, null, 2)}</pre>
          </details>
        </section>
        <section className="builder-sidebar">
          <h2>Detail frame</h2>
          <fieldset
            disabled={busy || !loaded}
            className="builder-fields"
            style={{ border: 0, padding: 0, margin: 0, display: "contents" }}
          >
            <label className="field">
              Nama frame
              <input
                value={draft.name}
                maxLength={80}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="Nama untuk kenangan baru"
              />
            </label>
            <div className="number-grid">
              <label className="field">
                Kategori
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      category: e.target.value as Draft["category"],
                    }))
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Tags (pisahkan koma)
                <input
                  value={draft.tags.join(",")}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      tags: e.target.value.split(",").slice(0, 10),
                    }))
                  }
                />
              </label>
            </div>
            <label className="file-drop">
              <Upload size={22} />
              <strong>
                {overlay ? "Ganti PNG overlay" : "Upload PNG overlay"}
              </strong>
              <span>Transparan · maks. 8 MB / 30 MP</span>
              <input
                type="file"
                aria-label="Upload PNG overlay"
                accept="image/png"
                onChange={(e) => {
                  void chooseFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <div>
              <h2 style={{ fontSize: 19, marginBottom: 12 }}>
                Slot foto · {draft.slots.length}/6
              </h2>
              <div className="slot-list">
                {draft.slots.map((slot, i) => (
                  <button
                    key={slot.id}
                    aria-pressed={selected === i}
                    onClick={() => {
                      setSelected(i);
                      setPreview(false);
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <Button
                  aria-label="Tambah slot"
                  variant="secondary"
                  disabled={draft.slots.length >= 6 || !overlay}
                  onClick={addSlot}
                >
                  <Plus size={17} />
                </Button>
              </div>
            </div>
            {current && (
              <>
                <div className="number-grid">
                  {(["x", "y", "width", "height", "borderRadius"] as const).map(
                    (key) => (
                      <label className="field" key={key}>
                        {
                          {
                            x: "Posisi X",
                            y: "Posisi Y",
                            width: "Lebar",
                            height: "Tinggi",
                            borderRadius: "Radius sudut",
                          }[key]
                        }
                        <input
                          aria-label={key}
                          type="number"
                          min={0}
                          max={1}
                          step={0.001}
                          value={Number((current[key] || 0).toFixed(6))}
                          onChange={(e) =>
                            updateSlot({ [key]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ),
                  )}
                  <label className="field">
                    Crop horizontal
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={current.cropPosition?.x ?? 0.5}
                      onChange={(e) =>
                        updateSlot({
                          cropPosition: {
                            x: Number(e.target.value),
                            y: current.cropPosition?.y ?? 0.5,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Crop vertikal
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={current.cropPosition?.y ?? 0.5}
                      onChange={(e) =>
                        updateSlot({
                          cropPosition: {
                            x: current.cropPosition?.x ?? 0.5,
                            y: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  <Button
                    variant="secondary"
                    aria-label="Urutan lebih awal"
                    disabled={selected === 0}
                    onClick={() => reorder(-1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label="Urutan lebih akhir"
                    disabled={selected === draft.slots.length - 1}
                    onClick={() => reorder(1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        slots: d.slots
                          .filter((_, i) => i !== selected)
                          .map((s, i) => ({ ...s, order: i })),
                      }));
                      setSelected(0);
                    }}
                  >
                    <Trash2 size={16} /> Hapus slot
                  </Button>
                </div>
              </>
            )}
            {!layout.success && draft.slots.length > 0 && (
              <p className="small" role="status">
                Belum siap publish:{" "}
                {[...new Set(layout.error.issues.map((i) => i.message))].join(
                  " ",
                )}
              </p>
            )}
            <Button
              variant="secondary"
              disabled={!overlay}
              onClick={() => void save()}
            >
              <Save size={17} />
              {busy ? "Menyimpan…" : "Save draft"}
            </Button>
            <Button
              disabled={!overlay || !layout.success}
              onClick={() => void save(true)}
            >
              <Eye size={17} /> Save & publish
            </Button>
          </fieldset>
          <p className="small">
            Menyimpan perubahan mengembalikan frame ke draft. Publish memeriksa
            transparansi tiap slot. Versi PNG lama tetap disimpan untuk sesi
            yang sedang berjalan.
          </p>
        </section>
      </div>
    </>
  );
}
