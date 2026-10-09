/** Результат «Поделиться»: открылось системное меню или картинка скачалась файлом. */
export type ShareResult = 'shared' | 'downloaded' | 'failed';

/**
 * Картинка → PNG → Web Share API (на телефонах) или скачивание файла (SPEC §6: canvas → blob →
 * Web Share API / скачивание). Отмена системного меню — не ошибка.
 */
export async function shareImage(
  image: HTMLImageElement,
  fileName: string,
  title: string,
  text: string,
): Promise<ShareResult> {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'failed';
  ctx.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'shared';
      // Иначе — пробуем скачать.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
