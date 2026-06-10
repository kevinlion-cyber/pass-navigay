import { Shield } from 'lucide-react';

interface ShieldRatingProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function ShieldRating({ rating, size = 16, interactive = false, onChange }: ShieldRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(level)}
          aria-label={`${level} bouclier${level > 1 ? 's' : ''}`}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
        >
          <Shield
            size={size}
            className={
              level <= rating
                ? 'fill-emerald-500 text-emerald-500'
                : 'fill-none text-gray-300 dark:text-gray-600'
            }
          />
        </button>
      ))}
    </div>
  );
}
