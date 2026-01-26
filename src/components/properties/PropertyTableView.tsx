import { Property } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  FileText, 
  Edit, 
  PowerOff, 
  PauseCircle, 
  PlayCircle,
  Building2,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PropertyTableViewProps {
  properties: Property[];
  propertyProjects: Record<string, string>;
  propertyProjectsProgress: Record<string, number>;
  onSelectProperty: (property: Property) => void;
  onEditProperty: (property: Property) => void;
  onOffboardProperty: (property: Property) => void;
  onHoldProperty: (property: Property) => void;
  onReactivateProperty: (property: Property) => void;
  searchQuery?: string;
}

const PropertyTableView = ({
  properties,
  propertyProjects,
  propertyProjectsProgress,
  onSelectProperty,
  onEditProperty,
  onOffboardProperty,
  onHoldProperty,
  onReactivateProperty,
  searchQuery = "",
}: PropertyTableViewProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case "Client-Managed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Company-Owned":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "On-Hold":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Inactive":
        return "bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400 border-gray-200 dark:border-gray-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRentalTypeColor = (type?: string) => {
    switch (type) {
      case "hybrid":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
      case "mid_term":
        return "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300";
      case "long_term":
        return "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300";
      default:
        return "";
    }
  };

  const getRentalTypeLabel = (type?: string) => {
    switch (type) {
      case "hybrid":
        return "🔄 Hybrid";
      case "mid_term":
        return "🏠 Mid-term";
      case "long_term":
        return "🏡 Long-term";
      default:
        return "—";
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-foreground px-0.5 rounded">{part}</mark> : 
        part
    );
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Property</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Rental</TableHead>
            <TableHead className="font-semibold">Progress</TableHead>
            <TableHead className="font-semibold text-right">Visit Price</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No properties found
              </TableCell>
            </TableRow>
          ) : (
            properties.map((property) => {
              const progress = propertyProjectsProgress[property.id] || 0;
              const isOnHold = property.propertyType === "On-Hold";
              const isInactive = property.propertyType === "Inactive";
              
              return (
                <TableRow
                  key={property.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/30 group transition-colors",
                    isOnHold && "bg-amber-50/50 dark:bg-amber-950/10",
                    isInactive && "opacity-60"
                  )}
                  onClick={() => onSelectProperty(property)}
                >
                  {/* Property Name & Address */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <div className="w-12 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {property.image_path ? (
                          <img 
                            src={property.image_path} 
                            alt={property.name}
                            className={cn(
                              "w-full h-full object-cover",
                              isInactive && "grayscale"
                            )}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-[200px]">
                          {searchQuery ? highlightText(property.name, searchQuery) : property.name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {searchQuery ? highlightText(property.address, searchQuery) : property.address}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Type Badge */}
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs font-medium", getTypeColor(property.propertyType))}
                    >
                      {isOnHold && <PauseCircle className="w-3 h-3 mr-1" />}
                      {property.propertyType === "Client-Managed" ? "Managed" : 
                       property.propertyType === "Company-Owned" ? "Owned" :
                       property.propertyType === "On-Hold" ? "On Hold" :
                       property.propertyType === "Inactive" ? "Inactive" : "—"}
                    </Badge>
                  </TableCell>

                  {/* Rental Type */}
                  <TableCell>
                    {property.rentalType ? (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        getRentalTypeColor(property.rentalType)
                      )}>
                        {getRentalTypeLabel(property.rentalType)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Progress */}
                  <TableCell>
                    {propertyProjects[property.id] ? (
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={progress} className="h-2 flex-1" />
                        <span className="text-xs font-medium w-10 text-right">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Visit Price */}
                  <TableCell className="text-right">
                    <span className="font-medium">
                      {formatCurrency(property.visitPrice)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProperty(property);
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditProperty(property);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      {isOnHold ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReactivateProperty(property);
                          }}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                        </Button>
                      ) : !isInactive ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              onHoldProperty(property);
                            }}
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOffboardProperty(property);
                            }}
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PropertyTableView;
