"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LockKeyhole,
  Plus,
  LogOut,
  EyeOff,
  Eye,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "./ui/button";
import { requestJson } from "@/lib/client";
import type { Frame, PublicFrame } from "@/lib/schema";
export type AdminFrame = Frame &
  Pick<PublicFrame, "overlayUrl" | "thumbnailUrl">;
export function Login() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="login-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        void requestJson("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        })
          .then(() => {
            setPassword("");
            router.replace("/admin");
            router.refresh();
          })
          .catch((e) => setError(e.message))
          .finally(() => setBusy(false));
      }}
    >
      <LockKeyhole size={27} />
      <h1>Ruang pengelola.</h1>
      <p>Kurasi frame untuk cerita yang akan datang.</p>
      <label className="field">
        Kata sandi operator
        <input
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Memeriksa…" : "Masuk ke studio"}
      </Button>
      <p className="small" style={{ marginTop: 20, marginBottom: 0 }}>
        Belum ada password default. Pengelola perlu mengatur ADMIN_PASSWORD_HASH
        dan ADMIN_SESSION_SECRET di environment server.
      </p>
    </form>
  );
}
export function Dashboard({ mode }: { mode: string }) {
  const [frames, setFrames] = useState<AdminFrame[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [loaded, setLoaded] = useState(false),
    [deleting, setDeleting] = useState<AdminFrame | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  async function load() {
    setError("");
    try {
      setFrames(
        (await requestJson<{ frames: AdminFrame[] }>("/api/admin/frames"))
          .frames,
      );
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    void requestJson<{ frames: AdminFrame[] }>("/api/admin/frames")
      .then((result) => {
        if (active) {
          setFrames(result.frames);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(frame: AdminFrame, operation: string) {
    setBusy(frame.id);
    setError("");
    try {
      await requestJson(
        `/api/admin/frames/${frame.id}${operation === "delete" ? "" : `/${operation}`}`,
        {
          method: operation === "delete" ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedRevision: frame.revision }),
        },
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Frame studio</h1>
        </div>
        <div>
          <Button asChild>
            <Link href="/admin/frames/new">
              <Plus size={17} /> Add frame
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void requestJson("/api/admin/logout", { method: "POST" })
                .then(() => {
                  router.replace("/admin/login");
                  router.refresh();
                })
                .catch((e) => setError(e.message));
            }}
          >
            <LogOut size={16} /> Keluar
          </Button>
        </div>
      </div>
      {mode === "mock" && (
        <p className="demo-label">
          DEMO · Perubahan frame disimpan di memori server dan hilang saat
          restart. Foto final tidak disimpan. Aktifkan google-drive untuk
          penyimpanan riil.
        </p>
      )}
      <div className="admin-stats">
        <div>
          <strong>
            {frames.filter((f) => f.status === "published").length}
          </strong>
          <span>Published</span>
        </div>
        <div>
          <strong>{frames.filter((f) => f.status === "draft").length}</strong>
          <span>Draft</span>
        </div>
        <div>
          <strong>
            {frames.filter((f) => f.status === "archived").length}
          </strong>
          <span>Archived</span>
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          {error} <button onClick={() => void load()}>Muat ulang</button>
        </div>
      )}
      {!loaded && !error && <p role="status">Memuat koleksi…</p>}
      {loaded && !frames.length && (
        <p className="empty">
          Koleksi masih kosong. Tambahkan frame pertamamu.
        </p>
      )}
      <div className="admin-grid">
        {frames.map((frame) => (
          <article className="admin-card" key={frame.id}>
            <div className="admin-thumb">
              {frame.thumbnailUrl && (
                <img src={frame.thumbnailUrl} alt={`Preview ${frame.name}`} />
              )}
            </div>
            <span className={`status-pill status-${frame.status}`}>
              {frame.status}
            </span>
            <h2>{frame.name}</h2>
            <p>
              {frame.slots.length} slot · {frame.dimensions.width} ×{" "}
              {frame.dimensions.height} px
              <br />
              Revisi {frame.revision} ·{" "}
              {new Date(frame.updatedAt).toLocaleDateString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}
            </p>
            <div className="inline-actions">
              <Button variant="secondary" asChild>
                <Link href={`/admin/frames/${frame.id}/edit`}>
                  <Pencil size={14} /> Edit
                </Link>
              </Button>
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() =>
                  void action(
                    frame,
                    frame.status === "published" ? "unpublish" : "publish",
                  )
                }
              >
                {frame.status === "published" ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}{" "}
                {frame.status === "published" ? "Unpublish" : "Publish"}
              </Button>
              {frame.status !== "archived" && (
                <Button
                  variant="danger"
                  aria-label={`Hapus ${frame.name}`}
                  disabled={!!busy}
                  onClick={() => {
                    setDeleting(frame);
                    dialog.current?.showModal();
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <dialog ref={dialog} onCancel={() => setDeleting(null)}>
        <h2>Arsipkan frame ini?</h2>
        <p>
          Frame {deleting?.name} akan disembunyikan dari galeri. Aset versi lama
          tetap disimpan agar sesi yang sedang berjalan dapat selesai. Foto
          hasil pengguna di Drive tidak dihapus.
        </p>
        <div className="inline-actions">
          <Button
            variant="secondary"
            onClick={() => {
              dialog.current?.close();
              setDeleting(null);
            }}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting) void action(deleting, "delete");
              dialog.current?.close();
              setDeleting(null);
            }}
          >
            Ya, arsipkan
          </Button>
        </div>
      </dialog>
    </>
  );
}
