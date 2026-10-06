import { tr } from "../i18n.js";
const MAX_WIDTH = 900;
const JPEG_QUALITY = 0.72;

// Verkleint een afbeelding en geeft een JPEG-dataURL terug (houdt localStorage klein).
export function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(tr("Kon bestand niet lezen.")));
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error(tr("Kon afbeelding niet laden.")));
      img.onload = () => {
        const scale = Math.min(1, MAX_WIDTH / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
