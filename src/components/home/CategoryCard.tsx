import React from 'react';
import { Link } from 'react-router-dom';
import type { ThemeName } from '../../lib/theme';
import { withThemeSearch } from '../../lib/theme';

interface CategoryCardProps {
  cat: {
    title: string;
    icon: React.ReactNode;
    desc: string;
    link: string;
  };
  theme: ThemeName;
}

export const CategoryCard: React.FC<CategoryCardProps> = React.memo(({ cat, theme }) => (
  <Link
    to={withThemeSearch(cat.link, theme)}
    className="flex items-start gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all group"
  >
    <div className="text-brand-primary group-hover:scale-110 transition-transform">
      {cat.icon}
    </div>
    <div>
      <h3 className="text-xl font-serif font-bold mb-1">
        {cat.title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed">
        {cat.desc}
      </p>
    </div>
  </Link>
));

export default CategoryCard;
