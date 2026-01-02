import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calculator, Search, Bot, CheckCircle } from "lucide-react";

interface ZillowPricingInstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: string;
}

export const ZillowPricingInstructionsModal = ({ 
  open, 
  onOpenChange, 
  address 
}: ZillowPricingInstructionsModalProps) => {
  const formattedAddress = address
    ?.trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-z0-9-]/g, "") || "";
  
  const zillowUrl = `https://www.zillow.com/homes/${formattedAddress}_rb/`;

  const copyPromptForAI = () => {
    const prompt = `Go to Zillow and find the Rent Zestimate for this property: ${address}. Tell me the monthly rent estimate.`;
    navigator.clipboard.writeText(prompt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            How to Get the Listing Price
          </DialogTitle>
          <DialogDescription>
            Follow these steps to determine the correct MidTermNation listing price
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              1
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Find the Rent Zestimate</h4>
              <p className="text-sm text-muted-foreground">
                Go to Zillow and search for this property. Look for the <strong>"Rent Zestimate"</strong> value 
                (not the sale price Zestimate).
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(zillowUrl, "_blank")}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Open Zillow
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* OR Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or ask AI</span>
            </div>
          </div>

          {/* AI Option */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
              <Bot className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Ask AI for the Rent Zestimate</h4>
              <p className="text-sm text-muted-foreground">
                Use ChatGPT, Claude, or any AI assistant to look up the rent estimate.
              </p>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={copyPromptForAI}
                className="gap-2"
              >
                <Bot className="h-4 w-4" />
                Copy AI Prompt
              </Button>
              <p className="text-xs text-muted-foreground italic">
                Prompt: "Go to Zillow and find the Rent Zestimate for {address?.substring(0, 30)}..."
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 pt-2 border-t">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              2
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Calculate the Listing Price</h4>
              <div className="p-3 bg-accent/50 rounded-lg border">
                <p className="text-sm font-mono">
                  <strong>Rent Zestimate × 2.2 = Listing Price</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Example: $3,000/mo × 2.2 = $6,600/mo listing price
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              3
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Enter the Values</h4>
              <p className="text-sm text-muted-foreground">
                Enter the Rent Zestimate in the property modal. The listing price will be calculated automatically.
              </p>
            </div>
          </div>

          {/* Important Note */}
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Important
                </p>
                <p className="text-xs text-muted-foreground">
                  The 2.2x multiplier accounts for furnished rentals, utilities, and mid-term rental premium. 
                  This is the price used across all MidTermNation listings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
