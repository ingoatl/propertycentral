import { Lead, STAGE_CONFIG, LeadStage } from "@/types/leads";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LeadTableViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

const LeadTableView = ({ leads, onSelectLead }: LeadTableViewProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Lead</TableHead>
            <TableHead className="font-semibold">Stage</TableHead>
            <TableHead className="font-semibold">Contact</TableHead>
            <TableHead className="font-semibold">Property</TableHead>
            <TableHead className="font-semibold">Source</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
            <TableHead className="font-semibold text-center">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                No leads found
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => {
              const stageConfig = STAGE_CONFIG[lead.stage];
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/30 group"
                  onClick={() => onSelectLead(lead)}
                >
                  {/* Lead Name */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1 h-8 rounded-full"
                        style={{ backgroundColor: stageConfig.accentColor }}
                      />
                      <div>
                        <p className="font-medium text-foreground">{lead.name}</p>
                        {lead.lead_number && (
                          <p className="text-xs text-muted-foreground">
                            #{lead.lead_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Stage */}
                  <TableCell>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: stageConfig.accentColor }}
                    >
                      {stageConfig.label}
                    </span>
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {lead.phone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${lead.phone}`);
                          }}
                          className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 text-primary" />
                        </button>
                      )}
                      {lead.email && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`mailto:${lead.email}`);
                          }}
                          className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </button>
                      )}
                      {!lead.phone && !lead.email && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Property */}
                  <TableCell>
                    {lead.property_address ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {lead.property_address}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Source */}
                  <TableCell>
                    {lead.opportunity_source ? (
                      <span className="text-sm text-muted-foreground">
                        {lead.opportunity_source}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Created */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </span>
                  </TableCell>

                  {/* AI Score */}
                  <TableCell className="text-center">
                    {lead.ai_qualification_score ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${lead.ai_qualification_score}%`,
                              backgroundColor: stageConfig.accentColor,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {lead.ai_qualification_score}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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

export default LeadTableView;
