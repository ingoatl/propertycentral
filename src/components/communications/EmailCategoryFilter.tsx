import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Filter, Check } from "lucide-react";
import { EMAIL_CATEGORIES } from "./EmailCategoryBadge";
import { cn } from "@/lib/utils";

interface EmailCategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function EmailCategoryFilter({ 
  selectedCategory, 
  onCategoryChange 
}: EmailCategoryFilterProps) {
  const selectedCat = EMAIL_CATEGORIES.find(c => c.value === selectedCategory);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-8 gap-1.5",
            selectedCategory && "bg-primary/10 border-primary/30"
          )}
        >
          {selectedCat ? (
            <>
              <selectedCat.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{selectedCat.label}</span>
            </>
          ) : (
            <>
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Category</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Filter by Category
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => onCategoryChange(null)}
          className="gap-2"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {!selectedCategory && <Check className="h-3.5 w-3.5" />}
          </div>
          All Categories
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {EMAIL_CATEGORIES.filter(c => c.value !== "other").map((cat) => {
          const Icon = cat.icon;
          return (
            <DropdownMenuItem
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className="gap-2"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {selectedCategory === cat.value && <Check className="h-3.5 w-3.5" />}
              </div>
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
