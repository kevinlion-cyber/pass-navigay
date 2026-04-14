import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';
import cropImage from '../../lib/cropImage';
import LoadingSpinner from './LoadingSpinner';

interface AvatarCropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

export default function AvatarCropModal({ imageSrc, onCancel, onConfirm }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await cropImage(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-light-surface dark:bg-dark-surface rounded-card w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-light-border dark:border-dark-border">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Recadrer la photo
          </h3>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative w-full aspect-square bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-5 py-3 flex items-center gap-3">
          <ZoomOut size={16} className="text-gray-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary h-1"
          />
          <ZoomIn size={16} className="text-gray-400 shrink-0" />
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-light-border dark:border-dark-border">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 btn-ghost py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <X size={16} />
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
          >
            {processing ? <LoadingSpinner size={16} /> : <Check size={16} />}
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
