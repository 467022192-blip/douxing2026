export interface PostImageAsset {
  original: string;
  min?: string;
}

const STORAGE_PUBLIC_SEGMENT = '/storage/v1/object/public/';
const STORAGE_RENDER_SEGMENT = '/storage/v1/render/image/public/';

const getMimeTypeFromName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });

export const normalizePostImages = (value: unknown): PostImageAsset[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string' && item.trim()) {
        return { original: item.trim() };
      }

      if (!item || typeof item !== 'object') return null;

      const candidate = item as Record<string, unknown>;
      const original =
        (typeof candidate.original === 'string' && candidate.original.trim()) ||
        (typeof candidate.url === 'string' && candidate.url.trim()) ||
        '';

      if (!original) return null;

      return {
        original,
        min: typeof candidate.min === 'string' && candidate.min.trim() ? candidate.min.trim() : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

export const getPostListImageSrc = (asset: PostImageAsset) => asset.min || asset.original;

export const getPostPreviewImages = (assets: PostImageAsset[]) =>
  assets.map((asset) => asset.original).filter(Boolean);

export const buildStorageRenderUrl = (url: string, width: number, quality = 76) => {
  if (!url.includes(STORAGE_PUBLIC_SEGMENT)) return null;
  return url.replace(STORAGE_PUBLIC_SEGMENT, STORAGE_RENDER_SEGMENT) + `?width=${width}&quality=${quality}&resize=cover`;
};

export const buildAttractionStoredMinUrl = (url: string) => {
  if (!url.includes(STORAGE_PUBLIC_SEGMENT)) return null;
  try {
    const parsed = new URL(url);
    const nextPath = parsed.pathname.replace(/\/cover\.[a-z0-9]+$/i, '/cover.min.webp');
    if (nextPath === parsed.pathname) return null;
    parsed.pathname = nextPath;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const getAttractionListImageUrl = (url?: string | null, minUrl?: string | null) => {
  if (minUrl?.trim()) return minUrl.trim();
  if (!url?.trim()) return '';
  return buildAttractionStoredMinUrl(url) || buildStorageRenderUrl(url, 720, 78) || url;
};

export const createMinImageFile = async (
  file: File,
  options?: {
    maxEdge?: number;
    quality?: number;
  }
) => {
  const maxEdge = options?.maxEdge ?? 720;
  const quality = options?.quality ?? 0.76;
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建图片压缩画布');
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) {
            resolve(value);
            return;
          }
          reject(new Error('生成缩略图失败'));
        },
        'image/webp',
        quality
      );
    });

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'image';
    return new File([blob], `${baseName}.min.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const inferContentTypeFromUrl = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    return getMimeTypeFromName(pathname);
  } catch {
    return 'image/jpeg';
  }
};
