import { usePOS } from '@/contexts/POSContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { memo } from 'react';

interface CategorySidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string) => void;
}

export const CategorySidebar = memo(function CategorySidebar({ selectedCategory, onSelectCategory }: CategorySidebarProps) {
  const { categories, t } = usePOS();

  return (
    <aside className="h-full bg-sidebar border-r border-sidebar-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-bold text-sidebar-foreground">Catégories</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categories.map((category, index) => (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              "category-btn",
              selectedCategory === category.id && "category-btn-active"
            )}
          >
            {category.image ? (
              <img 
                src={category.image} 
                alt={category.name} 
                className="w-10 h-10 object-cover rounded-lg mr-3 flex-shrink-0"
              />
            ) : (
              <span className="text-2xl mr-3">{category.icon || '🍽️'}</span>
            )}
            <span className="font-medium">{category.name}</span>
          </motion.button>
        ))}
      </div>
    </aside>
  );
});
