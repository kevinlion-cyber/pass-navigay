import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Maximize2, Minimize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { chargerImage, genererImage, zoomImageEntiere, type Fond } from '../../lib/recadrage';

interface RecadrageModalProps {
  source: string;
  /** Proportions du cadre de destination (largeur / hauteur). */
  proportion: number;
  titre: string;
  largeurSortie?: number;
  hauteurSortie?: number;
  /** Rond pour un logo ou un avatar. */
  forme?: 'rect' | 'round';
  onAnnuler: () => void;
  onValider: (blob: Blob) => void;
}

/**
 * Le recadrage d'image, le même partout (logo, bannière, galerie, événement, promotion,
 * avatar, inscription pro).
 *
 * Avant, il y en avait cinq versions différentes et, sur trois d'entre elles, le zoom ne
 * descendait pas en dessous de 1 : impossible de faire tenir une photo entière dans un
 * cadre qui n'a pas ses proportions, il fallait forcément couper. D'où la plainte de
 * Kévin (26/10/2026) : « c'est vraiment galère ».
 *
 * Ici on peut dézoomer jusqu'à voir toute la photo, la déplacer librement, et ce qui
 * dépasse du cadre est comblé par la photo floutée (ou du blanc).
 */
export default function RecadrageModal({
  source,
  proportion,
  titre,
  largeurSortie = 1200,
  hauteurSortie,
  forme = 'rect',
  onAnnuler,
  onValider,
}: RecadrageModalProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [zoomMini, setZoomMini] = useState(0.3);
  const [aire, setAire] = useState<Area | null>(null);
  const [fond, setFond] = useState<Fond>('flou');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le plancher du zoom dépend de la photo : inutile de laisser descendre plus bas que
  // le moment où elle tient entière dans le cadre.
  useEffect(() => {
    let vivant = true;
    chargerImage(source)
      .then((img) => {
        if (!vivant) return;
        const entiere = zoomImageEntiere(img.width, img.height, proportion);
        setZoomMini(Math.min(entiere, 1) * 0.9);
      })
      .catch(() => { if (vivant) setErreur("Cette image n'a pas pu être ouverte. Essayez-en une autre."); });
    return () => { vivant = false };
  }, [source, proportion]);

  const surRecadrage = useCallback((_: Area, pixels: Area) => setAire(pixels), []);

  /** La photo entière, visible d'un coup, sans rien couper. */
  const toutVoir = async () => {
    try {
      const img = await chargerImage(source);
      setZoom(zoomImageEntiere(img.width, img.height, proportion));
      setPosition({ x: 0, y: 0 });
    } catch { /* le message d'erreur est déjà posé */ }
  };

  /** La photo remplit le cadre : rien de vide, mais les bords sont coupés. */
  const remplirLeCadre = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const valider = async () => {
    if (!aire) return;
    setEnCours(true);
    try {
      const h = hauteurSortie ?? Math.round(largeurSortie / proportion);
      onValider(await genererImage(source, aire, largeurSortie, h, fond));
    } catch {
      setEnCours(false);
      setErreur("Le recadrage n'a pas abouti. Réessayez, ou choisissez une autre image.");
    }
  };

  // Des bords vides n'apparaissent que si on a dézoomé sous le remplissage du cadre.
  const bordsVides = zoom < 0.999;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full h-full md:w-full md:max-w-xl md:h-auto md:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0a0a0f', border: '1px solid #1e1e2e' }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}>
          <h3 className="text-[15px] font-semibold text-white">{titre}</h3>
          <button onClick={onAnnuler} aria-label="Fermer" className="p-1 text-[#606070] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 min-h-[280px] bg-black">
          <Cropper
            image={source}
            crop={position}
            zoom={zoom}
            aspect={proportion}
            minZoom={zoomMini}
            maxZoom={4}
            zoomSpeed={0.25}
            restrictPosition={false}
            cropShape={forme}
            showGrid={false}
            onCropChange={setPosition}
            onZoomChange={setZoom}
            onCropComplete={surRecadrage}
          />
        </div>

        <div className="shrink-0 px-5 py-4 flex flex-col gap-3" style={{ background: '#14141e', borderTop: '1px solid #1e1e2e' }}>
          {/* Les deux cas qu'on veut neuf fois sur dix, en un geste. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toutVoir}
              className="flex-1 py-2 rounded-[10px] text-[13px] text-white flex items-center justify-center gap-1.5 transition-colors hover:opacity-90"
              style={{ border: '1px solid #2a2a3a' }}
            >
              <Minimize2 size={15} /> Photo entière
            </button>
            <button
              type="button"
              onClick={remplirLeCadre}
              className="flex-1 py-2 rounded-[10px] text-[13px] text-white flex items-center justify-center gap-1.5 transition-colors hover:opacity-90"
              style={{ border: '1px solid #2a2a3a' }}
            >
              <Maximize2 size={15} /> Remplir le cadre
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="shrink-0" style={{ color: '#606070' }} />
            <input
              type="range"
              aria-label="Zoom"
              min={zoomMini}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1"
              style={{ accentColor: '#7B2D8B' }}
            />
            <ZoomIn size={16} className="shrink-0" style={{ color: '#606070' }} />
          </div>

          {bordsVides && (
            <div className="flex items-center gap-3 text-[12.5px]" style={{ color: '#a0a0b0' }}>
              <span className="shrink-0">Bords</span>
              {(['flou', 'blanc'] as Fond[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFond(f)}
                  className="px-3 py-1 rounded-full transition-colors"
                  style={fond === f
                    ? { background: '#7B2D8B', color: '#fff' }
                    : { border: '1px solid #2a2a3a', color: '#a0a0b0' }}
                >
                  {f === 'flou' ? 'Photo floutée' : 'Blanc'}
                </button>
              ))}
            </div>
          )}

          {erreur && <p className="text-[12.5px]" style={{ color: '#ff6b6b' }}>{erreur}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onAnnuler}
              disabled={enCours}
              className="flex-1 py-2.5 rounded-[10px] text-[14px] font-medium text-white transition-colors"
              style={{ border: '1px solid #2a2a3a' }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={valider}
              disabled={enCours || !aire}
              className="flex-[2] py-2.5 rounded-[10px] text-[14px] font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#7B2D8B' }}
            >
              {enCours && <LoadingSpinner size={16} />}
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
