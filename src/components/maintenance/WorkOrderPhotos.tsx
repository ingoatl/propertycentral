import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Image, Camera, X, ZoomIn, User } from "lucide-react";

interface WorkOrderPhotosProps {
  workOrderId: string;
}

interface Photo {
  id: string;
  photo_url: string;
  photo_type: string;
  uploaded_by: string;
  uploaded_by_type: string;
  caption: string | null;
  created_at: string;
}

const WorkOrderPhotos = ({ workOrderId }: WorkOrderPhotosProps) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["work-order-photos", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_photos")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Photo[];
    },
    enabled: !!workOrderId,
  });

  const photosByType = {
    before: photos.filter(p => p.photo_type === "before"),
    during: photos.filter(p => p.photo_type === "during"),
    after: photos.filter(p => p.photo_type === "after"),
    all: photos,
  };

  const getUploaderBadgeColor = (type: string) => {
    switch (type) {
      case 'vendor': return 'bg-orange-100 text-orange-700';
      case 'pm': return 'bg-green-100 text-green-700';
      case 'owner': return 'bg-purple-100 text-purple-700';
      case 'tenant': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">Loading photos...</div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Camera className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No photos yet</p>
        <p className="text-sm">Vendor will upload photos when they start work</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All ({photos.length})
          </TabsTrigger>
          <TabsTrigger value="before">
            Before ({photosByType.before.length})
          </TabsTrigger>
          <TabsTrigger value="during">
            During ({photosByType.during.length})
          </TabsTrigger>
          <TabsTrigger value="after">
            After ({photosByType.after.length})
          </TabsTrigger>
        </TabsList>

        {["all", "before", "during", "after"].map((type) => (
          <TabsContent key={type} value={type} className="mt-4">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {photosByType[type as keyof typeof photosByType].map((photo) => (
                <div 
                  key={photo.id}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                    <img 
                      src={photo.photo_url} 
                      alt={`${photo.photo_type} photo`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>

                  {/* Photo type badge */}
                  <Badge 
                    className="absolute top-1 left-1 text-xs capitalize"
                    variant="secondary"
                  >
                    {photo.photo_type}
                  </Badge>
                </div>
              ))}
            </div>

            {photosByType[type as keyof typeof photosByType].length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Image className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No {type} photos</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Photo Lightbox */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedPhoto && (
            <div className="relative">
              <img 
                src={selectedPhoto.photo_url} 
                alt={`${selectedPhoto.photo_type} photo`}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              
              {/* Photo info */}
              <div className="p-4 bg-background">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize">{selectedPhoto.photo_type}</Badge>
                    <Badge className={getUploaderBadgeColor(selectedPhoto.uploaded_by_type)}>
                      <User className="h-3 w-3 mr-1" />
                      {selectedPhoto.uploaded_by}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(selectedPhoto.created_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                
                {selectedPhoto.caption && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedPhoto.caption}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkOrderPhotos;
