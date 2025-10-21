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
                <div className="whitespace-pre-wrap text-foreground leading-relaxed space-y-4">
                  {sop.description.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4">
                      {paragraph.split('\n').map((line, lineIdx) => (
                        <span key={lineIdx}>
                          {line}
                          {lineIdx < paragraph.split('\n').length - 1 && <br />}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
