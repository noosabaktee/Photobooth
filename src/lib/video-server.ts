import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import QRCode from "qrcode";
import { driveFolderUrl } from "./urls";
import {
  starterBackdrop,
  starterPalette,
  type StarterStyle,
} from "./starter-artwork";
import { videoLayout } from "./video-design";
import { fail } from "./errors";
import {
  BOOMERANG_WIDTH,
  BOOMERANG_HEIGHT,
  BOOMERANG_FPS,
  BOOMERANG_SECONDS,
  BOOMERANG_IMAGE_BYTES,
  BOOMERANG_VIDEO_BYTES,
  slideshowOrder,
} from "./boomerang";
const execute = promisify(execFile);
const jobs = globalThis as typeof globalThis & { photoboothVideoJobs?: number };

async function temporary<T>(operation: (directory: string) => Promise<T>) {
  if ((jobs.photoboothVideoJobs || 0) >= 2)
    fail(
      429,
      "VIDEO_BUSY",
      "Pembuat video sedang sibuk. Coba beberapa saat lagi.",
    );
  jobs.photoboothVideoJobs = (jobs.photoboothVideoJobs || 0) + 1;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(path.join(tmpdir(), "kmi-boomerang-"));
    await chmod(directory, 0o700);
    return await operation(directory);
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      jobs.photoboothVideoJobs!--;
    }
  }
}

async function run(binary: string, args: string[], cwd: string) {
  try {
    return await execute(binary, args, {
      cwd,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      fail(
        503,
        "VIDEO_NOT_CONFIGURED",
        "Encoder video belum tersedia. Pengelola perlu memasang FFmpeg/FFprobe. PNG tetap bisa di-download.",
      );
    // Do not expose command output, paths or image data.
    return fail(
      400,
      "INVALID_VIDEO",
      "Video tidak dapat diproses. Coba buat ulang; PNG tetap bisa di-download.",
    );
  }
}
const encoder = () => process.env.FFMPEG_PATH || ffmpeg || "ffmpeg";
const probe = () => process.env.FFPROBE_PATH || ffprobe.path;

// Called only after the uploaded input has passed validateVideo. The folder ID
// already exists, but sharing waits until both finished media have been stored.
export async function stampVideo(
  bytes: Buffer,
  folderUrl: string,
  style: StarterStyle = "mint",
) {
  if (!driveFolderUrl(folderUrl))
    fail(400, "INVALID_DRIVE_LINK", "Link folder tidak valid.");
  if (!bytes.length || bytes.length > BOOMERANG_VIDEO_BYTES)
    fail(413, "FILE_TOO_LARGE", "Video melebihi batas.");
  const { width, height, footerTop, qrBox, qrX, qrY } = videoLayout;
  const modules =
    QRCode.create(folderUrl, { errorCorrectionLevel: "M" }).modules.size + 8;
  const qrSize = modules * Math.floor(qrBox / modules);
  if (!qrSize) fail(400, "INVALID_DRIVE_LINK", "Link folder terlalu panjang.");
  const qr = await QRCode.toBuffer(folderUrl, {
    type: "png",
    width: qrSize,
    margin: 4,
    errorCorrectionLevel: "M",
    color: {
      dark: style === "film" ? "#ffffff" : "#000000",
      light: "#00000000",
    },
  });
  const ink = starterPalette[style].ink;
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height - footerTop}"><g fill="${ink}" font-family="sans-serif"><text x="464" y="132" font-size="32" font-weight="bold">SCAN QR</text><text x="464" y="180" font-size="27">Kolase + video</text><text x="464" y="242" font-size="22">Hoya-Hoya Days</text><text x="464" y="280" font-size="18">Simpan kenanganmu</text></g></svg>`,
  );
  const footer = await sharp(Buffer.from(starterBackdrop(style, width, height)))
    .extract({ left: 0, top: footerTop, width, height: height - footerTop })
    .composite([
      {
        input: qr,
        left: qrX + Math.floor((qrBox - qrSize) / 2),
        top: qrY - footerTop + Math.floor((qrBox - qrSize) / 2),
      },
      { input: label, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  return temporary(async (directory) => {
    await writeFile(path.join(directory, "input.mp4"), bytes, { mode: 0o600 });
    await writeFile(path.join(directory, "footer.png"), footer, {
      mode: 0o600,
    });
    await run(
      encoder(),
      [
        "-nostdin",
        "-v",
        "error",
        "-threads",
        "2",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "mov",
        "-i",
        "input.mp4",
        "-i",
        "footer.png",
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        `[0:v][1:v]overlay=0:${footerTop}:format=auto[v]`,
        "-map",
        "[v]",
        "-an",
        "-map_metadata",
        "-1",
        "-t",
        "6",
        "-frames:v",
        "180",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-profile:v",
        "high",
        "-level:v",
        "4.1",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "2",
        "-movflags",
        "+faststart",
        "final.mp4",
      ],
      directory,
    );
    const output = await readFile(path.join(directory, "final.mp4"));
    if (output.length > BOOMERANG_VIDEO_BYTES)
      fail(413, "FILE_TOO_LARGE", "Video final melebihi 16 MiB.");
    return output;
  });
}

export async function encodeBoomerang(frames: Buffer[]) {
  const order = slideshowOrder(frames.length);
  return temporary(async (directory) => {
    for (const [i, bytes] of frames.entries()) {
      if (!bytes.length || bytes.length > BOOMERANG_IMAGE_BYTES)
        fail(413, "FILE_TOO_LARGE", "Setiap foto video maksimal 2 MiB.");
      if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
        fail(415, "UNSUPPORTED_TYPE", "Foto video harus berupa JPEG.");
      try {
        const image = sharp(bytes, {
          limitInputPixels: BOOMERANG_WIDTH * BOOMERANG_HEIGHT,
          failOn: "warning",
        });
        const meta = await image.metadata();
        if (
          meta.width !== BOOMERANG_WIDTH ||
          meta.height !== BOOMERANG_HEIGHT ||
          (meta.pages || 1) !== 1
        )
          throw new Error("Invalid dimensions");
        // Re-encode to strip metadata and fully decode before invoking FFmpeg.
        await image
          .jpeg({ quality: 94 })
          .toFile(path.join(directory, `photo-${i}.jpg`));
      } catch {
        fail(
          400,
          "INVALID_IMAGE",
          "Foto video harus JPEG valid 1080 × 1920 px, satu halaman.",
        );
      }
    }
    // Exactly one second per photo: 1 → 2 → 3 → 1 → 2 → 3 for a three-photo session.
    const list = order
      .map((index) => `file 'photo-${index}.jpg'\nduration 1`)
      .join("\n");
    await writeFile(
      path.join(directory, "sequence.txt"),
      `${list}\nfile 'photo-${order[order.length - 1]}.jpg'\n`,
      { mode: 0o600 },
    );
    await run(
      encoder(),
      [
        "-nostdin",
        "-v",
        "error",
        "-threads",
        "2",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "sequence.txt",
        "-an",
        "-map_metadata",
        "-1",
        "-t",
        String(BOOMERANG_SECONDS),
        "-vf",
        `fps=${BOOMERANG_FPS}`,
        "-frames:v",
        String(BOOMERANG_SECONDS * BOOMERANG_FPS),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-profile:v",
        "high",
        "-level:v",
        "4.1",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "2",
        "-movflags",
        "+faststart",
        "output.mp4",
      ],
      directory,
    );
    const bytes = await readFile(path.join(directory, "output.mp4"));
    if (bytes.length > BOOMERANG_VIDEO_BYTES)
      fail(413, "FILE_TOO_LARGE", "Video melebihi batas 16 MiB.");
    return bytes;
  });
}

export async function validateVideo(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > BOOMERANG_VIDEO_BYTES)
    fail(413, "FILE_TOO_LARGE", "Video kosong atau melebihi 16 MiB.");
  if (mime !== "video/mp4" || bytes.subarray(4, 8).toString() !== "ftyp")
    fail(415, "UNSUPPORTED_TYPE", "Video harus MP4 H.264.");
  return temporary(async (directory) => {
    await writeFile(path.join(directory, "input.mp4"), bytes, { mode: 0o600 });
    const { stdout } = await run(
      probe(),
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "mov",
        "-i",
        "input.mp4",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate",
        "-of",
        "json",
      ],
      directory,
    );
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: {
        codec_type: string;
        codec_name: string;
        width: number;
        height: number;
        pix_fmt: string;
        avg_frame_rate: string;
      }[];
    };
    const video = data.streams?.[0];
    const duration = Number(data.format?.duration);
    if (
      data.streams?.length !== 1 ||
      video?.codec_type !== "video" ||
      video.codec_name !== "h264" ||
      video.width !== BOOMERANG_WIDTH ||
      video.height !== BOOMERANG_HEIGHT ||
      video.pix_fmt !== "yuv420p" ||
      video.avg_frame_rate !== "30/1" ||
      !Number.isFinite(duration) ||
      Math.abs(duration - BOOMERANG_SECONDS) > 0.1
    )
      fail(
        400,
        "INVALID_VIDEO",
        "Gunakan video MP4 1080 × 1920, H.264, 30 fps, enam detik tanpa audio dari aplikasi.",
      );
    // Decode the complete bounded stream too; metadata alone cannot detect damaged frames.
    await run(
      encoder(),
      [
        "-nostdin",
        "-v",
        "error",
        "-xerror",
        "-threads",
        "2",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        "mov",
        "-i",
        "input.mp4",
        "-map",
        "0:v:0",
        "-t",
        "7",
        "-f",
        "null",
        "-",
      ],
      directory,
    );
  });
}
