import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  MessageSquare,
  Phone,
  Mail,
  User,
  Building2,
  Search,
  Filter,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SendSMSDialog } from "./SendSMSDialog";
import { useNavigate } from "react-router-dom";

interface CommunicationItem {
  id: string;
  type: "sms" | "email" | "call";
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  created_at: string;
  contact_name: string;
  contact_phone?: string;
  contact_type: "lead" | "owner";
  contact_id: string;
  status?: string;
}

export function InboxView() {
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<CommunicationItem | null>(null);
  const [showReply, setShowReply] = useState(false);
  const navigate = useNavigate();

  // Fetch all lead communications
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["all-communications", search, channelFilter, typeFilter],
    queryFn: async () => {
      const results: CommunicationItem[] = [];

      // Fetch lead communications
      let query = supabase
        .from("lead_communications")
        .select(`
          id,
          communication_type,
          direction,
          body,
          subject,
          created_at,
          status,
          lead_id,
          leads!inner(id, name, phone)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (channelFilter !== "all") {
        query = query.eq("communication_type", channelFilter);
      }

      const { data: leadComms } = await query;

      if (leadComms) {
        for (const comm of leadComms) {
          const lead = comm.leads as any;
          const item: CommunicationItem = {
            id: comm.id,
            type: comm.communication_type as "sms" | "email" | "call",
            direction: comm.direction as "inbound" | "outbound",
            body: comm.body,
            subject: comm.subject || undefined,
            created_at: comm.created_at,
            contact_name: lead?.name || "Unknown",
            contact_phone: lead?.phone || undefined,
            contact_type: "lead",
            contact_id: comm.lead_id,
            status: comm.status || undefined,
          };

          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            if (
              !item.contact_name.toLowerCase().includes(searchLower) &&
              !item.body.toLowerCase().includes(searchLower)
            ) {
              continue;
            }
          }

          // Apply type filter
          if (typeFilter !== "all" && item.contact_type !== typeFilter) {
            continue;
          }

          results.push(item);
        }
      }

      return results;
    },
  });

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelColor = (type: string) => {
    switch (type) {
      case "sms":
        return "bg-blue-100 text-blue-700";
      case "email":
        return "bg-purple-100 text-purple-700";
      case "call":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>All Communications</span>
              <Badge variant="secondary">{communications.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading communications...
                </div>
              ) : communications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No communications found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {communications.map((comm) => (
                    <div
                      key={comm.id}
                      onClick={() => setSelectedMessage(comm)}
                      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedMessage?.id === comm.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-full ${getChannelColor(
                            comm.type
                          )}`}
                        >
                          {getChannelIcon(comm.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {comm.contact_name}
                              </span>
                              <Badge
                                variant={
                                  comm.contact_type === "lead"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {comm.contact_type}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(comm.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                comm.direction === "inbound"
                                  ? "border-green-500 text-green-600"
                                  : "border-blue-500 text-blue-600"
                              }`}
                            >
                              {comm.direction === "inbound" ? "Received" : "Sent"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {comm.subject ? `${comm.subject}: ` : ""}
                            {comm.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Message Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-full ${getChannelColor(
                      selectedMessage.type
                    )}`}
                  >
                    {getChannelIcon(selectedMessage.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedMessage.contact_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedMessage.contact_phone || "No phone"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Channel</span>
                    <Badge className={getChannelColor(selectedMessage.type)}>
                      {selectedMessage.type.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Direction</span>
                    <Badge variant="outline">
                      {selectedMessage.direction === "inbound" ? "Received" : "Sent"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>
                      {format(
                        new Date(selectedMessage.created_at),
                        "MMM d, yyyy h:mm a"
                      )}
                    </span>
                  </div>
                </div>

                {selectedMessage.subject && (
                  <div>
                    <label className="text-sm font-medium">Subject</label>
                    <p className="text-sm mt-1">{selectedMessage.subject}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Message</label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {selectedMessage.body}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  {selectedMessage.contact_phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReply(true)}
                      className="flex-1"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/leads")}
                    className="flex-1"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    View {selectedMessage.contact_type}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a message to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reply Dialog */}
      {selectedMessage && selectedMessage.contact_phone && (
        <SendSMSDialog
          open={showReply}
          onOpenChange={setShowReply}
          contactName={selectedMessage.contact_name}
          contactPhone={selectedMessage.contact_phone}
          contactType={selectedMessage.contact_type}
          contactId={selectedMessage.contact_id}
        />
      )}
    </div>
  );
}
