import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OnboardingSOP } from "@/types/onboarding";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SOPDialogProps {
  sop: OnboardingSOP | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SOPDialog = ({ sop, open, onOpenChange }: SOPDialogProps) => {
  if (!sop) return null;

  // Extract Loom video ID from URL
  const getLoomEmbedUrl = (url: string) => {
    const match = url.match(/loom\.com\/(share|embed)\/([a-zA-Z0-9]+)/);
    return match ? `https://www.loom.com/embed/${match[2]}` : null;
  };

  const embedUrl = sop.loom_video_url ? getLoomEmbedUrl(sop.loom_video_url) : null;

  // Format the description with better styling for steps and headlines
  const formatDescription = (text: string) => {
    const lines = text.split('\n');
    const formattedContent: JSX.Element[] = [];
    let key = 0;

    lines.forEach((line, idx) => {
      const trimmedLine = line.trim();
      
      // Empty line - add spacing
      if (!trimmedLine) {
        formattedContent.push(<div key={key++} className="h-3" />);
        return;
      }

      // Step numbers (e.g., "1.", "Step 1:", "1)")
      if (/^(Step\s+)?\d+[.:)]/.test(trimmedLine)) {
        formattedContent.push(
          <div key={key++} className="mt-4 first:mt-0">
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border-l-4 border-blue-500">
              <span className="font-bold text-blue-700 dark:text-blue-400 text-lg">{trimmedLine}</span>
            </div>
          </div>
        );
        return;
      }

      // Headlines (all caps, or starts with ##, or ends with :)
      if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 || 
          trimmedLine.startsWith('##') || 
          (trimmedLine.endsWith(':') && trimmedLine.length < 50)) {
        const cleanedLine = trimmedLine.replace(/^#+\s*/, '');
        formattedContent.push(
          <h4 key={key++} className="text-base font-bold text-primary mt-4 first:mt-0 mb-2 pb-1 border-b border-primary/20">
            {cleanedLine}
          </h4>
        );
        return;
      }

      // Bullet points
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const content = trimmedLine.replace(/^[•\-*]\s*/, '');
        formattedContent.push(
          <div key={key++} className="flex items-start gap-2 ml-4 mb-1">
            <span className="text-primary mt-1.5">•</span>
            <span className="flex-1">{content}</span>
          </div>
        );
        return;
      }

      // Regular paragraph
      formattedContent.push(
        <p key={key++} className="mb-2 leading-relaxed">
          {trimmedLine}
        </p>
      );
    });

    return formattedContent;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{sop.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-4 pr-4">
            {embedUrl && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={embedUrl}
                  frameBorder="0"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  title={sop.title}
                />
              </div>
            )}
            {sop.description && (
              <div className="prose prose-sm max-w-none">
                <div className="text-foreground">
                  {formatDescription(sop.description)}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
