import { BadRequestException, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private getPublicApiBase() {
    return (
      process.env.API_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.PUBLIC_API_URL ??
      ''
    ).replace(/\/$/, '');
  }

  private normalizeRelativePath(input: string) {
    return input.startsWith('/') ? input : `/${input}`;
  }

  private mapLocalhostUploadsToRelative(url: string) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isLocalhostHost =
        host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocalhostHost) return url;
      if (!parsed.pathname.startsWith('/uploads/')) return url;
      const search = parsed.search ?? '';
      const hash = parsed.hash ?? '';
      return `${parsed.pathname}${search}${hash}`;
    } catch {
      return url;
    }
  }

  toAbsoluteMediaUrl(url?: string | null) {
    if (!url) return null;
    const trimmed = String(url).trim();
    if (!trimmed) return null;
    const apiBase = this.getPublicApiBase();
    if (/^https?:\/\//i.test(trimmed)) {
      const maybeRelative = this.mapLocalhostUploadsToRelative(trimmed);
      if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
      return apiBase
        ? `${apiBase}${this.normalizeRelativePath(maybeRelative)}`
        : maybeRelative;
    }
    const normalized = this.normalizeRelativePath(trimmed);
    if (!apiBase) return normalized;
    return `${apiBase}${normalized}`;
  }

  private buildPublicStorageUrl(key: string) {
    const normalizedKey = key.replace(/^\//, '');
    const r2Base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (r2Base) {
      return `${r2Base}/${normalizedKey}`;
    }
    const apiBase = this.getPublicApiBase();
    if (!apiBase) {
      return this.normalizeRelativePath(`uploads/${normalizedKey}`);
    }
    return `${apiBase}/uploads/${normalizedKey}`;
  }

  buildObjectReference(args: {
    merchantId: string;
    documentType: string;
    fileName: string;
  }) {
    const sanitizedFile = args.fileName
      .replace(/[^a-zA-Z0-9.-]+/g, '-')
      .toLowerCase();
    const randomId = crypto.randomBytes(8).toString('hex');
    const key = `merchant/${args.merchantId}/${args.documentType}/${Date.now()}-${randomId}-${sanitizedFile}`;
    const url = this.buildPublicStorageUrl(key);
    return { key, url };
  }

  buildProductImageReference(fileName: string) {
    const sanitizedFile = fileName
      .replace(/[^a-zA-Z0-9.-]+/g, '-')
      .toLowerCase();
    const randomId = crypto.randomBytes(6).toString('hex');
    const key = `products/${Date.now()}-${randomId}-${sanitizedFile}`;
    const url = this.buildPublicStorageUrl(key);
    return { key, url };
  }

  buildProductImageUploadInit(args: {
    fileName: string;
    mimeType?: string;
    sizeBytes?: number;
  }) {
    const { key, url } = this.buildProductImageReference(args.fileName);
    return {
      key,
      uploadUrl: url,
      publicUrl: url,
      method: 'PUT',
      headers: {
        ...(args.mimeType ? { 'Content-Type': args.mimeType } : {}),
      },
      expiresInSeconds: 900,
      note: 'Upload the binary file directly to uploadUrl with PUT, then call complete endpoint.',
    };
  }

  completeProductImageUpload(args: {
    key: string;
    fileName: string;
    mimeType?: string;
    sizeBytes?: number;
    altText?: string;
  }) {
    const url = this.buildPublicStorageUrl(args.key);
    return {
      key: args.key,
      url,
      fileName: args.fileName,
      mimeType: args.mimeType ?? null,
      sizeBytes: args.sizeBytes ?? null,
      altText: args.altText ?? null,
    };
  }

  async saveProductImageFile(args: {
    fileName: string;
    buffer: Buffer;
    mimeType?: string;
    sizeBytes?: number;
  }) {
    const mime = (args.mimeType ?? '').toLowerCase();
    if (!mime.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed.');
    }
    const maxBytes = 12 * 1024 * 1024;
    if (args.sizeBytes && args.sizeBytes > maxBytes) {
      throw new BadRequestException(
        'Image too large. Maximum upload size is 12MB.',
      );
    }

    const pipeline = sharp(args.buffer, { failOn: 'none' }).rotate();
    const metadata = await pipeline.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 500 || height < 500) {
      throw new BadRequestException(
        'Image resolution is too low. Minimum is 500x500.',
      );
    }

    const optimizedMain = await pipeline
      .clone()
      .resize({
        width: 2200,
        height: 2200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer();

    const optimizedCard = await pipeline
      .clone()
      .resize({
        width: 1080,
        height: 1080,
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: false,
      })
      .webp({ quality: 80 })
      .toBuffer();

    const optimizedThumb = await pipeline
      .clone()
      .resize({
        width: 360,
        height: 360,
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: false,
      })
      .webp({ quality: 76 })
      .toBuffer();

    const ref = this.buildProductImageReference(args.fileName);
    const baseKey = ref.key.replace(/^\//, '').replace(/\.[^.]+$/, '');
    const key = `${baseKey}.webp`;
    const cardKey = `${baseKey}-card.webp`;
    const thumbKey = `${baseKey}-thumb.webp`;
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const targetPath = path.join(uploadsRoot, key);
    const cardPath = path.join(uploadsRoot, cardKey);
    const thumbPath = path.join(uploadsRoot, thumbKey);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await Promise.all([
      writeFile(targetPath, optimizedMain),
      writeFile(cardPath, optimizedCard),
      writeFile(thumbPath, optimizedThumb),
    ]);
    return {
      key,
      url: this.toAbsoluteMediaUrl(`/uploads/${key}`),
      variants: {
        card: this.toAbsoluteMediaUrl(`/uploads/${cardKey}`),
        thumb: this.toAbsoluteMediaUrl(`/uploads/${thumbKey}`),
      },
      fileName: args.fileName,
      mimeType: args.mimeType ?? null,
      sizeBytes: optimizedMain.byteLength,
    };
  }

  async saveMerchantDocumentFile(args: {
    merchantId: string;
    documentType: string;
    fileName: string;
    buffer: Buffer;
    mimeType?: string;
    sizeBytes?: number;
  }) {
    const mime = (args.mimeType ?? '').toLowerCase();
    const allowedMimes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);
    if (!allowedMimes.has(mime)) {
      throw new BadRequestException(
        'Only JPG, PNG, WEBP, or PDF documents are supported.',
      );
    }
    const maxBytes = 12 * 1024 * 1024;
    if (args.sizeBytes && args.sizeBytes > maxBytes) {
      throw new BadRequestException(
        'Document too large. Maximum upload size is 12MB.',
      );
    }

    const sanitizedFile = args.fileName
      .replace(/[^a-zA-Z0-9.-]+/g, '-')
      .toLowerCase();
    const ref = this.buildObjectReference({
      merchantId: args.merchantId,
      documentType: args.documentType,
      fileName: sanitizedFile,
    });
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const key = `merchant-docs/${ref.key.replace(/^merchant\//, '')}`;
    const targetPath = path.join(uploadsRoot, key);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, args.buffer);

    return {
      key,
      url: this.toAbsoluteMediaUrl(`/uploads/${key}`),
      fileName: args.fileName,
      mimeType: args.mimeType ?? null,
      sizeBytes: args.sizeBytes ?? args.buffer.byteLength,
    };
  }
}
