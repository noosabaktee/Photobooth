import { beforeAll, it, expect, vi } from "vitest";
import { readdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { encodeBoomerang, validateVideo } from "@/lib/video-server";
const execute = promisify(execFile);
let frames: Buffer[], video: Buffer;
const temporaryFiles = async () =>
  (await readdir(tmpdir()))
    .filter((n) => n.startsWith("kmi-boomerang-"))
    .sort();
beforeAll(async () => {
  frames = await Promise.all(
    ["#e02030", "#20d040", "#3040df"].map((background) =>
      sharp({ create: { width: 1080, height: 1920, channels: 3, background } })
        .jpeg()
        .toBuffer(),
    ),
  );
  const before = await temporaryFiles();
  video = await encodeBoomerang(frames);
  expect(await temporaryFiles()).toEqual(before);
}, 60000);

it("encodes actual H.264/MP4, 1080x1920, 30 fps, six seconds, no audio, and fully decodes it", async () => {
  expect(video.subarray(4, 8).toString()).toBe("ftyp");
  const before = await temporaryFiles();
  await expect(validateVideo(video, "video/mp4")).resolves.toBeUndefined();
  expect(await temporaryFiles()).toEqual(before);
}, 60000);

it("all 180 decoded video frames hold each photo for one second in order 1 → 2 → 3 → 1 → 2 → 3", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "kmi-video-test-"));
  try {
    await writeFile(path.join(directory, "video.mp4"), video);
    const { stdout } = await execute(
      ffmpeg!,
      [
        "-v",
        "error",
        "-i",
        path.join(directory, "video.mp4"),
        "-vf",
        "scale=1:1",
        "-vsync",
        "0",
        "-frames:v",
        "180",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ],
      { encoding: "buffer", windowsHide: true, timeout: 30000 },
    );
    expect(stdout.length).toBe(180 * 3);
    const dominant = Array.from({ length: 180 }, (_, i) => {
      const channels = [...stdout.subarray(i * 3, i * 3 + 3)];
      return channels.indexOf(Math.max(...channels));
    });
    expect(dominant).toEqual(
      Array.from({ length: 180 }, (_, i) => Math.floor(i / 30) % 3),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);

it("rejects forged/truncated MP4 and oversized, corrupt or incorrectly sized source images", async () => {
  await expect(validateVideo(video, "image/png")).rejects.toMatchObject({
    status: 415,
  });
  await expect(
    validateVideo(video.subarray(0, 100), "video/mp4"),
  ).rejects.toMatchObject({ code: "INVALID_VIDEO" });
  await expect(
    validateVideo(Buffer.alloc(16 * 1024 * 1024 + 1), "video/mp4"),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    encodeBoomerang([Buffer.alloc(2 * 1024 * 1024 + 1)]),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    encodeBoomerang([frames[0].subarray(0, 100)]),
  ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  const small = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "#fff" },
  })
    .jpeg()
    .toBuffer();
  await expect(encodeBoomerang([small])).rejects.toMatchObject({
    code: "INVALID_IMAGE",
  });
}, 60000);

it("cleans temporary images after an unavailable encoder and reports configuration error", async () => {
  const before = await temporaryFiles();
  vi.stubEnv(
    "FFMPEG_PATH",
    path.join(tmpdir(), "missing-kmi-encoder", "ffmpeg"),
  );
  try {
    await expect(encodeBoomerang(frames)).rejects.toMatchObject({
      code: "VIDEO_NOT_CONFIGURED",
    });
  } finally {
    vi.unstubAllEnvs();
  }
  expect(await temporaryFiles()).toEqual(before);
}, 60000);
