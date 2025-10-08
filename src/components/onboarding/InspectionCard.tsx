import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Calendar, User, Image, Wrench, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface InspectionCardProps {
  projectId: string;
}

export const InspectionCard = ({ projectId }: InspectionCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Mock inspection data - in a real app, this would come from the database
  const inspectionData = {
    date: "9/18/2025",
    inspector: "Ingo Schaer",
    status: "Completed",
    progress: 64,
    photos: 74,
    passed: 52,
    failed: 6,
    serialNumbers: {
      hvac: "Multiple units - see photos",
      refrigerator: "See nameplate photo",
      dishwasher: "See nameplate photo",
      washer: "See nameplate photo",
      dryer: "See nameplate photo",
    },
    propertyDetails: {
      bedrooms: 2,
      bathrooms: 3,
      internetSpeed: "Download/Upload Mbps",
    },
    notes: "Inspection completed with minor issues. First aid kit missing in kitchen.",
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-lg">Property Inspection Report</CardTitle>
                  <CardDescription>Completed inspection with photos and equipment details</CardDescription>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Inspection Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{inspectionData.date}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{inspectionData.inspector}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Image className="w-4 h-4 text-muted-foreground" />
                <span>{inspectionData.photos} photos</span>
              </div>
              <Badge variant="outline" className="w-fit">
                {inspectionData.progress}% Complete
              </Badge>
            </div>

            {/* Results Summary */}
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {inspectionData.passed} Passed
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {inspectionData.failed} Failed
              </Badge>
            </div>

            {/* Equipment Serial Numbers */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="w-4 h-4" />
                <span>Equipment Serial Numbers</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-white rounded border">
                  <span className="text-muted-foreground">HVAC: </span>
                  <a 
                    href="https://peachhaus-str-inspect.lovable.app/property/04c0c98d-443f-4d53-9f2a-8234f8bc1b34#photos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    {inspectionData.serialNumbers.hvac}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-muted-foreground">Refrigerator: </span>
                  <a 
                    href="https://peachhaus-str-inspect.lovable.app/property/04c0c98d-443f-4d53-9f2a-8234f8bc1b34#photos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    {inspectionData.serialNumbers.refrigerator}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-muted-foreground">Dishwasher: </span>
                  <a 
                    href="https://peachhaus-str-inspect.lovable.app/property/04c0c98d-443f-4d53-9f2a-8234f8bc1b34#photos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    {inspectionData.serialNumbers.dishwasher}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-muted-foreground">Washer: </span>
                  <a 
                    href="https://peachhaus-str-inspect.lovable.app/property/04c0c98d-443f-4d53-9f2a-8234f8bc1b34#photos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    {inspectionData.serialNumbers.washer}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-2 bg-white rounded border">
                  <span className="text-muted-foreground">Dryer: </span>
                  <a 
                    href="https://peachhaus-str-inspect.lovable.app/property/04c0c98d-443f-4d53-9f2a-8234f8bc1b34#photos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    {inspectionData.serialNumbers.dryer}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Property Details */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Property Details</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 bg-white rounded border text-center">
                  <div className="text-2xl font-bold text-primary">{inspectionData.propertyDetails.bedrooms}</div>
                  <div className="text-xs text-muted-foreground">Bedrooms</div>
                </div>
                <div className="p-2 bg-white rounded border text-center">
                  <div className="text-2xl font-bold text-primary">{inspectionData.propertyDetails.bathrooms}</div>
                  <div className="text-xs text-muted-foreground">Bathrooms</div>
                </div>
                <div className="p-2 bg-white rounded border text-center">
                  <div className="text-lg font-bold text-primary">✓</div>
                  <div className="text-xs text-muted-foreground">Internet Test</div>
                </div>
              </div>
            </div>

            {/* Inspection Notes */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Notes</div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                {inspectionData.notes}
              </div>
            </div>

            {/* Link to Full Report */}
            <div className="pt-2">
              <a
                href="https://peachhaus-str-inspect.lovable.app/property/04c0c98d-443f-4d53-9f2a-8234f8bc1b34#photos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                View Full Inspection Report with Photos →
              </a>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
