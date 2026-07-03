import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

// Or « sponsor » appliqué en style inline (et non via la classe fill-sponsor) :
// Safari ne rend pas correctement le fill custom sur l'icône étoile lucide via classe,
// alors qu'il le fait via style inline (comme la bulle de la carte). Boucliers non concernés.
const GOLD = '#d4a017';

export default function StarRating({ rating, size = 16, interactive = false, onChange }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            aria-label={`${star} etoile${star > 1 ? 's' : ''}`}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
          >
            <Star
              size={size}
              className={filled ? '' : 'text-gray-300 dark:text-gray-600'}
              style={filled ? { fill: GOLD, color: GOLD } : { fill: 'none' }}
            />
          </button>
        );
      })}
    </div>
  );
}
