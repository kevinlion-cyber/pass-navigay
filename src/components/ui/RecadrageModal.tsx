import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Maximize2, Minimize2, MoveHorizontal, MoveVertical, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { chargerImage, etirerImage, genererImage, zoomImageEntiere, type Fond } from '../../lib/recadrage';

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

  // Étirement demandé par Kévin : la largeur et la hauteur se règlent séparément.
  // 1 et 1 = photo intacte. On déforme la photo une fois, et tout le reste (zoom,
  // déplacement, recadrage, bords) travaille ensuite sur cette version : ce qu'on voit
  // à l'écran est exactement ce qui sera enregistré.
  const [etireLargeur, setEtireLargeur] = useState(1);
  const [etireHauteur, setEtireHauteur] = useState(1);
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [sourceTravail, setSourceTravail] = useState(source);
  const deforme = etireLargeur !== 1 || etireHauteur !== 1;

  useEffect(() => {
    let vivant = true;
    setSourceTravail(source);
    chargerImage(source)
      .then((img) => { if (vivant) setOriginal(img) })
      .catch(() => { if (vivant) setErreur("Cette image n'a pas pu être ouverte. Essayez-en une autre."); });
    return () => { vivant = false };
  }, [source]);

  // Le curseur envoie beaucoup d'événements : on ne refabrique l'image qu'une fois le
  // geste posé, sinon on recalcule une image entière à chaque pixel parcouru.
  useEffect(() => {
    if (!original) return;
    if (!deforme) { setSourceTravail(source); return }
    const t = setTimeout(() => setSourceTravail(etirerImage(original, etireLargeur, etireHauteur)), 120);
    return () => clearTimeout(t);
  }, [original, etireLargeur, etireHauteur, deforme, source]);

  // Le plancher du zoom dépend des proportions de la photo, étirement compris : inutile
  // de laisser descendre plus bas que le moment où elle tient entière dans le cadre.
  useEffect(() => {
    let vivant = true;
    chargerImage(sourceTravail)
      .then((img) => {
        if (!vivant) return;
        setZoomMini(Math.min(zoomImageEntiere(img.width, img.height, proportion), 1) * 0.9);
      })
      .catch(() => { /* l'erreur est déjà signalée au chargement de la source */ });
    return () => { vivant = false };
  }, [sourceTravail, proportion]);

  const surRecadrage = useCallback((_: Area, pixels: Area) => setAire(pixels), []);

  /** La photo entière, visible d'un coup, sans rien couper. */
  const toutVoir = async () => {
    try {
      const img = await chargerImage(sourceTravail);
      setZoom(zoomImageEntiere(img.width, img.height, proportion));
      setPosition({ x: 0, y: 0 });
    } catch { /* le message d'erreur est déjà posé */ }
  };

  const rétablirProportions = () => {
    setEtireLargeur(1);
    setEtireHauteur(1);
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
      onValider(await genererImage(sourceTravail, aire, largeurSortie, h, fond));
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
            image={sourceTravail}
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

          {/* Largeur et hauteur séparées : la photo se déforme, c'est voulu. */}
          <div className="flex items-center gap-2">
            <MoveHorizontal size={16} className="shrink-0" style={{ color: '#606070' }} />
            <input
              type="range"
              aria-label="Étirer en largeur"
              min={0.5}
              max={2}
              step={0.01}
              value={etireLargeur}
              onChange={(e) => setEtireLargeur(Number(e.target.value))}
              className="flex-1 h-1 min-w-0"
              style={{ accentColor: '#7B2D8B' }}
            />
            <MoveVertical size={16} className="shrink-0" style={{ color: '#606070' }} />
            <input
              type="range"
              aria-label="Étirer en hauteur"
              min={0.5}
              max={2}
              step={0.01}
              value={etireHauteur}
              onChange={(e) => setEtireHauteur(Number(e.target.value))}
              className="flex-1 h-1 min-w-0"
              style={{ accentColor: '#7B2D8B' }}
            />
            <button
              type="button"
              onClick={rétablirProportions}
              disabled={!deforme}
              aria-label="Rétablir les proportions"
              title="Rétablir les proportions"
              className="shrink-0 p-1 rounded transition-colors disabled:opacity-30"
              style={{ color: deforme ? '#fff' : '#606070' }}
            >
              <RotateCcw size={15} />
            </button>
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
