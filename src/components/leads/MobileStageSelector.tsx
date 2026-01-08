import { LeadStage, STAGE_CONFIG, LEAD_STAGES } from "@/types/leads";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileStageSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStage: LeadStage;
  onStageSelect: (stage: LeadStage) => void;
}

const MobileStageSelector = ({
  open,
  onOpenChange,
  currentStage,
  onStageSelect,
}: MobileStageSelectorProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Move to Stage</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8 space-y-1">
          {LEAD_STAGES.map(({ stage, title, description }) => {
            const config = STAGE_CONFIG[stage];
            const isSelected = stage === currentStage;

            return (
              <button
                key={stage}
                onClick={() => onStageSelect(stage)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors",
                  isSelected
                    ? "bg-primary/10"
                    : "hover:bg-muted active:bg-muted"
                )}
              >
                {/* Color indicator */}
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: config.accentColor }}
                />

                {/* Stage info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "font-medium",
                      isSelected && "text-primary"
                    )}
                  >
                    {config.label}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {description}
                  </p>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <Check
                    className="h-5 w-5 shrink-0"
                    style={{ color: config.accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileStageSelector;
