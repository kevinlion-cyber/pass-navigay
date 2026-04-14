import { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import ProsCropModal from './ProsCropModal';

export interface Step3Data {
  logoBlob: Blob | null;
  logoPreview: string | null;
  bannerBlob: Blob | null;
  bannerPreview: string | null;
  galleryBlobs: Blob[];
  galleryPreviews: string[];
}

interface RegisterStep3Props {
  data: Step3Data;
  onChange: (data: Step3Data) => void;
  onPrev: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export default function RegisterStep3({ data, onChange, onPrev, onSubmit, submitting }: RegisterStep3Props) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'logo' | 'banner' | 'gallery'>('logo');
  const [galleryQueue, setGalleryQueue] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [tempGalleryBlobs, setTempGalleryBlobs] = useState<Blob[]>([]);
  const [tempGalleryPreviews, setTempGalleryPreviews] = useState<string[]>([]);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (type: 'logo' | 'banner', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = type === 'logo' ? 5 : 10;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Taille max : ${maxSize}MB`);
      return;
    }
    setCropType(type);
    setCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const total = data.galleryBlobs.length + files.length;
    if (total > 5) {
      toast.error('Maximum 5 photos pour la galerie.');
      e.target.value = '';
      return;
    }
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error('Chaque photo doit faire moins de 5MB.');
        e.target.value = '';
        return;
      }
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setCropType('gallery');
    setGalleryQueue(urls);
    setGalleryIndex(0);
    setTempGalleryBlobs([]);
    setTempGalleryPreviews([]);
    setCropSrc(urls[0]);
    e.target.value = '';
  };

  const handleCropConfirm = (blob: Blob) => {
    const preview = URL.createObjectURL(blob);

    if (cropType === 'logo') {
      onChange({ ...data, logoBlob: blob, logoPreview: preview });
      setCropSrc(null);
    } else if (cropType === 'banner') {
      onChange({ ...data, bannerBlob: blob, bannerPreview: preview });
      setCropSrc(null);
    } else if (cropType === 'gallery') {
      const newBlobs = [...tempGalleryBlobs, blob];
      const newPreviews = [...tempGalleryPreviews, preview];

      if (galleryIndex + 1 < galleryQueue.length) {
        setTempGalleryBlobs(newBlobs);
        setTempGalleryPreviews(newPreviews);
        const nextIdx = galleryIndex + 1;
        setGalleryIndex(nextIdx);
        setCropSrc(galleryQueue[nextIdx]);
      } else {
        onChange({
          ...data,
          galleryBlobs: [...data.galleryBlobs, ...newBlobs],
          galleryPreviews: [...data.galleryPreviews, ...newPreviews],
        });
        setGalleryQueue([]);
        setTempGalleryBlobs([]);
        setTempGalleryPreviews([]);
        setCropSrc(null);
      }
    }
  };

  const handleCropCancel = () => {
    if (cropType === 'gallery' && galleryQueue.length > 0) {
      if (tempGalleryBlobs.length > 0) {
        onChange({
          ...data,
          galleryBlobs: [...data.galleryBlobs, ...tempGalleryBlobs],
          galleryPreviews: [...data.galleryPreviews, ...tempGalleryPreviews],
        });
      }
      setGalleryQueue([]);
      setTempGalleryBlobs([]);
      setTempGalleryPreviews([]);
    }
    setCropSrc(null);
  };

  const removeGalleryPhoto = (idx: number) => {
    onChange({
      ...data,
      galleryBlobs: data.galleryBlobs.filter((_, i) => i !== idx),
      galleryPreviews: data.galleryPreviews.filter((_, i) => i !== idx),
    });
  };

  const cropAspect = cropType === 'logo' ? 1 : cropType === 'banner' ? 16 / 9 : 4 / 3;
  const cropTitle =
    cropType === 'logo'
      ? 'Recadre ton logo'
      : cropType === 'banner'
        ? 'Recadre ta photo principale'
        : `Recadre la photo ${galleryIndex + 1}/${galleryQueue.length}`;
  const cropOutputW = cropType === 'logo' ? 400 : cropType === 'banner' ? 1280 : 800;
  const cropOutputH = cropType === 'logo' ? 400 : cropType === 'banner' ? 720 : 600;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-white">Ajoute tes photos</h2>
        <p className="text-[13px] mt-1" style={{ color: '#a0a0b0' }}>
          Un bon visuel, c'est ce qui donne envie de venir. Tu pourras en ajouter d'autres plus tard.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wider mb-1" style={{ color: '#a0a0b0' }}>
          LOGO (format carré 1:1)
        </p>
        <p className="text-[12px] mb-3" style={{ color: '#606070' }}>
          Affiché en vignette dans les listes et sur la carte.
        </p>

        {data.logoPreview ? (
          <div className="flex items-center gap-4">
            <img src={data.logoPreview} alt="" className="w-24 h-24 rounded-full object-cover" />
            <button
              onClick={() => logoRef.current?.click()}
              className="text-[13px] font-medium transition-colors hover:underline"
              style={{ color: '#7B2D8B' }}
            >
              Changer
            </button>
          </div>
        ) : (
          <button
            onClick={() => logoRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-[10px] transition-colors hover:border-[#7B2D8B]"
            style={{ border: '2px dashed #2a2a3a', height: 140 }}
          >
            <Store size={28} style={{ color: '#606070' }} />
            <span className="text-[13px] text-[#c0c0d0]">Clique pour ajouter ton logo</span>
            <span className="text-[11px]" style={{ color: '#606070' }}>JPG, PNG, WEBP · Max 5MB</span>
          </button>
        )}
        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFileSelect('logo', e)} />
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wider mb-1" style={{ color: '#a0a0b0' }}>
          PHOTO PRINCIPALE (format 16:9)
        </p>
        <p className="text-[12px] mb-3" style={{ color: '#606070' }}>
          Image mise en avant sur ta fiche. Montre l'ambiance de ton établissement.
        </p>

        {data.bannerPreview ? (
          <div>
            <img src={data.bannerPreview} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: '16/9' }} />
            <button
              onClick={() => bannerRef.current?.click()}
              className="mt-2 text-[13px] font-medium transition-colors hover:underline"
              style={{ color: '#7B2D8B' }}
            >
              Changer
            </button>
          </div>
        ) : (
          <button
            onClick={() => bannerRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-[10px] transition-colors hover:border-[#7B2D8B]"
            style={{ border: '2px dashed #2a2a3a', height: 160 }}
          >
            <Camera size={28} style={{ color: '#606070' }} />
            <span className="text-[13px] text-[#c0c0d0]">Clique pour ajouter ta photo principale</span>
            <span className="text-[11px]" style={{ color: '#606070' }}>JPG, PNG, WEBP · Max 10MB</span>
          </button>
        )}
        <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFileSelect('banner', e)} />
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wider mb-1" style={{ color: '#a0a0b0' }}>
          GALERIE DE PHOTOS (optionnel)
        </p>
        <p className="text-[12px] mb-3" style={{ color: '#606070' }}>
          Ajoute jusqu'à 5 photos pour donner envie. Tu pourras en ajouter d'autres depuis ton dashboard.
        </p>

        {data.galleryPreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {data.galleryPreviews.map((src, i) => (
              <div key={i} className="relative rounded-md overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeGalleryPhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full"
                  style={{ background: 'rgba(0,0,0,0.7)' }}
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {data.galleryBlobs.length < 5 && (
          <button
            onClick={() => galleryRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-[10px] transition-colors hover:border-[#7B2D8B]"
            style={{ border: '2px dashed #2a2a3a' }}
          >
            <ImageIcon size={28} style={{ color: '#606070' }} />
            <span className="text-[13px] text-[#c0c0d0]">Clique ou glisse tes photos ici</span>
            <span className="text-[11px]" style={{ color: '#606070' }}>
              Jusqu'à {5 - data.galleryBlobs.length} photo{5 - data.galleryBlobs.length > 1 ? 's' : ''} · JPG, PNG, WEBP · Max 5MB chacune
            </span>
          </button>
        )}
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleGallerySelect} />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onPrev}
          disabled={submitting}
          className="flex-1 py-3.5 rounded-[10px] text-[14px] font-medium text-white transition-colors"
          style={{ border: '1px solid #2a2a3a' }}
        >
          &larr; Précédent
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-[2] py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-colors"
          style={{ background: '#7B2D8B' }}
        >
          Créer mon compte et mon établissement
        </button>
      </div>

      {cropSrc && (
        <ProsCropModal
          imageSrc={cropSrc}
          aspect={cropAspect}
          title={cropTitle}
          outputWidth={cropOutputW}
          outputHeight={cropOutputH}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
