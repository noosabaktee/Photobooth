import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new AppError(status, code, message);
}
export async function api(action: () => Promise<Response>) {
  try {
    const response = await action();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: e.issues.map((i) => i.message).join(" "),
          },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    const error =
      e instanceof AppError
        ? e
        : new AppError(
            503,
            "STORAGE_UNAVAILABLE",
            "Penyimpanan belum tersedia atau kuota/izin Drive bermasalah. Coba lagi atau download lokal.",
          );
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
