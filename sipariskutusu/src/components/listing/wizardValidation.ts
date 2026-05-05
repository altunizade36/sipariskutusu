import { ListingDraft } from '../../context/ListingWizardContext';

export function parseDraftPrice(price: string): number {
  return Number(price.replace(',', '.'));
}

export function extractHashtags(value: string): string[] {
  const matches = value.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();

  return matches
    .map((item) => item.trim().toLocaleLowerCase('tr-TR'))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    })
    .slice(0, 12);
}

export function validateDraft(draft: ListingDraft): string[] {
  const issues: string[] = [];

  if (draft.title.trim().length < 6) issues.push('Başlık en az 6 karakter olmalı.');
  if (draft.description.trim().length < 20) issues.push('Açıklama en az 20 karakter olmalı.');

  if (draft.price.trim()) {
    const parsedPrice = parseDraftPrice(draft.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      issues.push('Fiyat girildiğinde geçerli bir tutar olmalı.');
    }
  }

  const stock = Number(draft.stock);
  if (!Number.isFinite(stock) || stock < 1) issues.push('Stok adedi en az 1 olmalı.');

  if (!draft.city.trim()) issues.push('İl seçilmeli.');
  if (!draft.district.trim()) issues.push('İlçe seçilmeli.');
  if (draft.delivery.length === 0) issues.push('En az bir teslimat yöntemi seçilmeli.');
  if (draft.photos.length === 0 && !draft.videoUri.trim()) {
    issues.push('En az bir medya eklenmeli (fotoğraf veya video).');
  }

  const hashtags = extractHashtags(draft.hashtags);
  if (draft.hashtags.trim() && hashtags.length === 0) {
    issues.push('Hashtag formatı geçersiz. Örnek: #elbise #vintage');
  }

  if (hashtags.length > 10) {
    issues.push('En fazla 10 hashtag kullanabilirsin.');
  }

  return issues;
}

export function hasBlockingIssues(draft: ListingDraft): boolean {
  return validateDraft(draft).length > 0;
}
