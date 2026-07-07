import { put } from "@vercel/blob";
import { ok, fail, withApi, requireUser, requireFeature } from "@/server/http";

// BE-21 — POST /api/games/cover: upload de capa de jogo manual (RF-32).
// Reusa o fluxo Vercel Blob da foto de perfil (2 MB, image/*).
const MAX_SIZE = 2 * 1024 * 1024;

export const POST = withApi("games.cover", async (req) => {
  requireFeature("manualGames");
  const { userId } = await requireUser();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail(503, "blob_unconfigured", "Upload de capa indisponível neste ambiente.");
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail(422, "missing_file", "Envie um arquivo no campo 'file'.");
  }
  if (!file.type.startsWith("image/")) {
    return fail(422, "invalid_type", "A capa precisa ser uma imagem.");
  }
  if (file.size > MAX_SIZE) {
    return fail(422, "file_too_large", "A capa precisa ter no máximo 2 MB.");
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const blob = await put(`covers/${userId}/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return ok({ url: blob.url });
});
