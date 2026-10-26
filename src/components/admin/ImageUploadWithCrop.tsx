import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import RecadrageModal from '../ui/RecadrageModal';

interface ImageUploadWithCropProps {
  currentImageUrl: string | null;
  onImageCropped: (blob: Blob) => void;
  aspectRatio: number;
  label: string;
  hint?: string;
}

/**
 * Le champ « photo » des formulaires (événement, promotion, administration).
 * Le recadrage lui-même est celui de `RecadrageModal`, commun à tout le site : une seule
 * façon de cadrer une image, qu'on soit gérant ou administrateur.
 */
export default function ImageUploadWithCrop({
  currentImageUrl,
  onImageCropped,
  aspectRatio,
  label,
  hint,
}: ImageUploadWithCropProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [aRecadrer, setARecadrer] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview || currentImageUrl;

  const choisirFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setARecadrer(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <div className="mb-5">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#a0a0b0] mb-1">{label}</p>
        {hint && <p className="text-[11px] text-[#606070] mb-2">{hint}</p>}

        {displayUrl ? (
          <div>
            <img src={displayUrl} alt="" className="w-full rounded-lg object-cover mb-2" style={{ maxHeight: 160 }} />
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
            <span className="text-[13px] text-[#606070]">Cliquez ou déposez une image ici</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={choisirFichier}
        />
      </div>

      {aRecadrer && (
        <RecadrageModal
          source={aRecadrer}
          proportion={aspectRatio}
          titre="Recadrer l'image"
          largeurSortie={1200}
          onValider={(blob) => {
            setPreview(URL.createObjectURL(blob));
            onImageCropped(blob);
            setARecadrer(null);
          }}
          onAnnuler={() => setARecadrer(null)}
        />
      )}
    </>
  );
}
