interface VisuelEntierProps {
  src: string;
  alt?: string;
  /** Classes du cadre (hauteur ou proportions). */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Un visuel montré EN ENTIER, quel que soit le cadre qui l'accueille.
 *
 * Avant, les visuels de promotion et d'événement étaient affichés en « object-cover » dans
 * des bandeaux très larges : l'image recadrée en 4:3 était alors rognée en haut et en bas
 * (plainte de Kévin, 25/11/2026 : « le résultat ne correspond pas au cadrage »).
 * Ici l'image est posée en entier, et la place restante est comblée par la même image
 * floutée — le même principe que la bannière de la fiche établissement.
 */
export default function VisuelEntier({ src, alt = '', className = '', style }: VisuelEntierProps) {
  return (
    <div className={`relative overflow-hidden bg-black ${className}`} style={style}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70"
      />
      <img src={src} alt={alt} className="relative w-full h-full object-contain" />
    </div>
  );
}
