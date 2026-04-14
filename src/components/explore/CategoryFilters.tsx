import { CATEGORIES, CATEGORY_KEYS } from '../../lib/constants';
import type { CategoryKey } from '../../lib/types';
import FilterDropdown from '../ui/FilterDropdown';

interface CategoryFiltersProps {
  selectedCategory: CategoryKey | null;
  selectedSubcategories: string[];
  onCategoryChange: (category: CategoryKey | null) => void;
  onSubcategoryToggle: (subcategory: string) => void;
}

type CategoryOption = CategoryKey | 'all';

export default function CategoryFilters({
  selectedCategory,
  selectedSubcategories,
  onCategoryChange,
  onSubcategoryToggle,
}: CategoryFiltersProps) {
  const categoryOptions: { value: CategoryOption; label: string }[] = [
    { value: 'all', label: 'Tout' },
    ...CATEGORY_KEYS.map((key) => ({ value: key as CategoryOption, label: CATEGORIES[key].label })),
  ];

  const subcategories = selectedCategory ? CATEGORIES[selectedCategory].subcategories : [];

  const subOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Tous les types' },
    ...subcategories.map((s) => ({ value: s, label: s })),
  ];

  const currentSub = selectedSubcategories.length === 1 ? selectedSubcategories[0] : 'all';

  return (
    <div className="flex gap-2">
      <FilterDropdown
        label="Categorie"
        value={selectedCategory ?? 'all'}
        options={categoryOptions}
        onChange={(val) => onCategoryChange(val === 'all' ? null : val as CategoryKey)}
      />
      {subcategories.length > 0 && (
        <FilterDropdown
          label="Type"
          value={currentSub}
          options={subOptions}
          onChange={(val) => {
            if (val === 'all') {
              selectedSubcategories.forEach((s) => onSubcategoryToggle(s));
            } else {
              selectedSubcategories.forEach((s) => onSubcategoryToggle(s));
              onSubcategoryToggle(val);
            }
          }}
        />
      )}
    </div>
  );
}
