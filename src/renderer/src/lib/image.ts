// Prepara una foto para enviarla a la IA: la decodifica (incluye HEIC en Safari/iPad), la reduce a un
// máximo de 1568 px por lado (lo recomendado para visión) y la convierte a JPEG. La foto original no se guarda.
export async function fileToJpegBase64(file: File, maxSide = 1568, quality = 0.85): Promise<{ base64: string; previewUrl: string; bytes: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen (prueba con JPG o PNG).'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return { base64, previewUrl: dataUrl, bytes: Math.round((base64.length * 3) / 4) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
