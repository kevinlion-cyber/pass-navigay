import { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, X } from 'lucide-react';

interface ImageUploadWithCropProps {
  currentImageUrl: string | null;
  onImageCropped: (blob: Blob) => void;
  aspectRatio: number;
  label: string;
  hint?: string;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pixelCrop.width);
  canvas.height = Math.round(pixelCrop.height);
  const ctx = canvas.getContext('2d')!;
  // Fond blanc : quand on réduit l'image pour la faire tenir entièrement dans le cadre,
  // les zones non couvertes sont remplies en blanc (sinon noir en JPEG).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Dessine l'image entière décalée selon l'origine du crop -> gère zoom avant ET arrière.
  ctx.drawImage(image, -pixelCrop.x, -pixelCrop.y);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.9
    );
  });
}

export default function ImageUploadWithCrop({
  currentImageUrl,
  onImageCropped,
  aspectRatio,
  label,
  hint,
}: ImageUploadWithCropProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview || currentImageUrl;

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleValidate = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      onImageCropped(blob);
    } catch {
      // ignore
    }
    setCropSrc(null);
  };

  return (
    <>
      <div className="mb-5">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#a0a0b0] mb-1">{label}</p>
        {hint && <p className="text-[11px] text-[#606070] mb-2">{hint}</p>}

        {displayUrl ? (
          <div>
            <img
              src={displayUrl}
              alt=""
              className="w-full rounded-lg object-cover mb-2"
              style={{ maxHeight: 160 }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-[13px] px-4 py-2 rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'transparent', border: '1px solid #2a2a3a', color: '#a0a0b0' }}
            >
              Changer la photo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-lg transition-colors hover:border-[#3a3a4a]"
            style={{ border: '2px dashed #2a2a3a', height: 120 }}
          >
            <Camera size={24} className="text-[#606070]" />
            <span className="text-[13px] text-[#606070]">Clique ou depose une image ici</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {cropSrc && (
        <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: '#0a0a0f' }}>
          <div
            className="shrink-0 flex items-center justify-between px-5 py-4"
            style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}
          >
            <span className="text-[15px] font-semibold text-white">Recadrer l'image</span>
            <button onClick={() => setCropSrc(null)} className="text-[#606070] hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 relative" style={{ minHeight: 300, background: '#000' }}>
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              minZoom={0.4}
              aspect={aspectRatio}
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape="rect"
              showGrid={false}
            />
          </div>

          <div
            className="shrink-0 px-5 py-4 space-y-4"
            style={{ background: '#14141e', borderTop: '1px solid #1e1e2e' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#a0a0b0] shrink-0">Zoom</span>
              <input
                type="range"
                min={0.4}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: '#7B2D8B' }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCropSrc(null)}
                className="flex-1 py-2.5 rounded-lg text-[14px] transition-colors hover:opacity-90"
                style={{ background: 'transparent', border: '1px solid #2a2a3a', color: '#a0a0b0' }}
              >
                Annuler
              </button>
              <button
                onClick={handleValidate}
                className="flex-[2] py-2.5 rounded-lg text-[14px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: '#7B2D8B' }}
              >
                Valider le crop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
