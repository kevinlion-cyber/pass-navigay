/**
 * Fabrication de l'image finale après recadrage.
 *
 * Particularité : l'aire de recadrage peut DÉPASSER l'image, parce qu'on autorise à
 * dézoomer jusqu'à voir la photo entière dans un cadre qui n'a pas ses proportions.
 * Les bords qui restent sont alors comblés, sinon le JPEG les rend en noir.
 */

export interface AireRecadrage {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Comment combler ce qui dépasse de la photo. */
export type Fond = 'flou' | 'blanc';

export function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error("L'image n'a pas pu être lue.")));
    img.src = url;
  });
}

/**
 * Le zoom en dessous duquel il n'y a plus rien à gagner : celui où la photo entière
 * tient dans le cadre. Au-delà de 1, react-easy-crop remplit le cadre (le reste est coupé).
 */
export function zoomImageEntiere(largeurImage: number, hauteurImage: number, proportionCadre: number) {
  if (!largeurImage || !hauteurImage || !proportionCadre) return 1;
  const proportionImage = largeurImage / hauteurImage;
  return Math.min(proportionImage / proportionCadre, proportionCadre / proportionImage);
}

/**
 * L'image étirée en largeur et/ou en hauteur, indépendamment l'une de l'autre.
 *
 * Demandé par Kévin (26/10/2026) pour faire entrer une photo dans un cadre qui n'a pas
 * ses proportions. ⚠ Cela DÉFORME la photo : à 1 de chaque côté, elle est intacte.
 *
 * On travaille sur une copie bornée en taille : étirer une photo d'appareil photo au
 * double sans garde-fou fabriquerait une image énorme à chaque mouvement du curseur.
 */
export function etirerImage(img: HTMLImageElement, etireLargeur: number, etireHauteur: number, coteMax = 2000): string {
  let l = img.width * etireLargeur;
  let h = img.height * etireHauteur;
  const reduction = Math.min(1, coteMax / Math.max(l, h));
  l = Math.max(1, Math.round(l * reduction));
  h = Math.max(1, Math.round(h * reduction));

  const canvas = document.createElement('canvas');
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, l, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function genererImage(
  source: string,
  aire: AireRecadrage,
  largeur: number,
  hauteur: number,
  fond: Fond = 'flou',
): Promise<Blob> {
  const img = await chargerImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(largeur));
  canvas.height = Math.max(1, Math.round(hauteur));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  if (fond === 'flou') {
    // La photo elle-même, agrandie et floutée : les bords se fondent au lieu de faire
    // une bande blanche en travers de la bannière.
    const couverture = Math.max(canvas.width / img.width, canvas.height / img.height) * 1.3;
    const l = img.width * couverture;
    const h = img.height * couverture;
    ctx.filter = 'blur(28px)';
    ctx.drawImage(img, (canvas.width - l) / 2, (canvas.height - h) / 2, l, h);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const echelle = canvas.width / aire.width;
  ctx.drawImage(img, -aire.x * echelle, -aire.y * echelle, img.width * echelle, img.height * echelle);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("L'image n'a pas pu être enregistrée."))),
      'image/jpeg',
      0.9,
    );
  });
}
