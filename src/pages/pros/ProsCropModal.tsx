import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import cropImage from '../../lib/cropImage';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProsCropModalProps {
  imageSrc: string;
  aspect: number;
  title: string;
  outputWidth?: number;
  outputHeight?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

export default function ProsCropModal({
  imageSrc,
  aspect,
  title,
  outputWidth = 800,
  outputHeight,
  onCancel,
  onConfirm,
}: ProsCropModalProps) {
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
      const h = outputHeight ?? Math.round(outputWidth / aspect);
      const blob = await cropImage(imageSrc, croppedAreaPixels, outputWidth, h);
      onConfirm(blob);
    } catch {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-0 md:p-4"
      style={{ zIndex: 2000, background: 'rgba(0,0,0,0.85)' }}
    >
      <div
        className="w-full h-full md:w-full md:max-w-lg md:h-auto md:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0a0a0f', border: '1px solid #1e1e2e' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}
        >
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 transition-colors"
            style={{ color: '#606070' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#606070')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 min-h-[300px] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div
          className="shrink-0 px-5 py-4 flex flex-col gap-4"
          style={{ background: '#14141e', borderTop: '1px solid #1e1e2e' }}
        >
          <div className="flex items-center gap-3">
            <ZoomOut size={16} style={{ color: '#606070' }} className="shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1"
              style={{ accentColor: '#7B2D8B' }}
            />
            <ZoomIn size={16} style={{ color: '#606070' }} className="shrink-0" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={processing}
              className="flex-1 py-2.5 rounded-[10px] text-[14px] font-medium text-white transition-colors"
              style={{ border: '1px solid #2a2a3a' }}
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="flex-1 py-2.5 rounded-[10px] text-[14px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
              style={{ background: '#7B2D8B' }}
            >
              {processing ? <LoadingSpinner size={16} /> : null}
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
