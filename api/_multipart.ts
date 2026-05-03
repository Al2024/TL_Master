import type { IncomingMessage } from "http";
import formidable, { type Fields, type Files, type File } from "formidable";
import fs from "fs/promises";

export type MultipartFile = {
  buffer: Buffer;
  originalFilename?: string | null;
};

export type MultipartResult = {
  fields: Record<string, string | string[]>;
  file?: MultipartFile;
};

export async function parseMultipart(req: IncomingMessage): Promise<MultipartResult> {
  const form = formidable({
    multiples: false,
    maxFileSize: 50 * 1024 * 1024,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, async (err: Error | null, fields: Fields, files: Files) => {
      if (err) {
        reject(err);
        return;
      }

      const uploaded = files.file as File | File[] | undefined;
      if (!uploaded) {
        resolve({ fields: fields as Record<string, string | string[]> });
        return;
      }

      const fileEntry = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      try {
        const buffer = await fs.readFile(fileEntry.filepath);
        resolve({
          fields: fields as Record<string, string | string[]>,
          file: {
            buffer,
            originalFilename: fileEntry.originalFilename,
          },
        });
      } catch (readError) {
        reject(readError);
      }
    });
  });
}
