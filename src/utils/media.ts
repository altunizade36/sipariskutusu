type ProductMediaLike = {
  image?: string;
  mediaUris?: string[];
  videoUri?: string;
};

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);

export function isVideoUri(uri?: string): boolean {
  if (!uri) return false;

  const cleanUri = uri.split('?')[0].toLowerCase();
  const ext = cleanUri.split('.').pop() ?? '';
  return VIDEO_EXTENSIONS.has(ext);
}

export function getOrderedMediaUris(input: ProductMediaLike): string[] {
  if (input.mediaUris && input.mediaUris.length > 0) {
    return input.mediaUris.filter(Boolean);
  }

  const fallback = [input.image, input.videoUri].filter(Boolean) as string[];
  return fallback;
}

export function resolveMediaCover(input: ProductMediaLike): string {
  const ordered = getOrderedMediaUris(input);
  const firstImage = ordered.find((uri) => !isVideoUri(uri));
  return firstImage ?? input.videoUri ?? ordered[0] ?? input.image ?? '';
}

export function hasVideoMedia(input: ProductMediaLike): boolean {
  if (input.videoUri) {
    return true;
  }

  return getOrderedMediaUris(input).some((uri) => isVideoUri(uri));
}
