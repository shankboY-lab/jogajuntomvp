import { put } from "@vercel/blob";
import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";

// BE-06 — upload de foto de perfil (RF-07): Vercel Blob, limite 2 MB, image/*.
const MAX_SIZE = 2 * 1024 * 1024;

export const POST = withApi("profile.photo", async (req) => {
  const { userId } = await requireUser();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail(503, "blob_unconfigured", "Upload de foto indisponível neste ambiente.");
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail(422, "missing_file", "Envie um arquivo no campo 'file'.");
  }
  if (!file.type.startsWith("image/")) {
    return fail(422, "invalid_type", "A foto precisa ser uma imagem.");
  }
  if (file.size > MAX_SIZE) {
    return fail(422, "file_too_large", "A foto precisa ter no máximo 2 MB.");
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const blob = await put(`avatars/${userId}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  // se o perfil já existe, atualiza direto; senão o cliente envia photoUrl no PUT
  await prisma.profile.updateMany({ where: { userId }, data: { photoUrl: blob.url } });

  return ok({ url: blob.url });
});
