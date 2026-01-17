import { useState, useEffect } from "react";
import { Brain, RefreshCw, CheckCircle, AlertCircle, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
}

interface ToneProfile {
  id: string;
  user_id: string | null;
  formality_level: string | null;
  common_greetings: any;
  common_closings: any;
  signature_phrases: any;
  avg_sentence_length: number | null;
  punctuation_style: string | null;
  emoji_usage: string | null;
  analyzed_email_count: number | null;
  analyzed_sms_count: number | null;
  last_analyzed_at: string | null;
}

export function ToneProfilesManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toneProfiles, setToneProfiles] = useState<Map<string, ToneProfile>>(new Map());
  const [analyzingUserId, setAnalyzingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load all approved team members
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name")
        .eq("status", "approved")
        .order("first_name");

      if (profilesError) throw profilesError;

      // Load all tone profiles
      const { data: toneData, error: toneError } = await supabase
        .from("user_tone_profiles")
        .select("*");

      if (toneError) throw toneError;

      setProfiles(profilesData || []);
      
      // Map tone profiles by user_id
      const toneMap = new Map<string, ToneProfile>();
      (toneData || []).forEach((tp: ToneProfile) => {
        if (tp.user_id) {
          toneMap.set(tp.user_id, tp);
        }
      });
      setToneProfiles(toneMap);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeTone = async (userId: string, email: string, firstName: string | null) => {
    setAnalyzingUserId(userId);
    
    try {
      const { data, error } = await supabase.functions.invoke("analyze-tone", {
        body: { 
          userId,
          senderEmail: email 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Tone analyzed for ${firstName || email}! Analyzed ${data.emails_analyzed} emails and ${data.sms_analyzed} SMS.`);
      loadData(); // Refresh the data
    } catch (error: any) {
      console.error("Error analyzing tone:", error);
      toast.error(`Failed to analyze tone: ${error.message}`);
    } finally {
      setAnalyzingUserId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading team profiles...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle>AI Tone Profiles</CardTitle>
            </div>
            <Badge variant="outline">
              {toneProfiles.size} / {profiles.length} analyzed
            </Badge>
          </div>
          <CardDescription>
            Analyze each team member's writing style to enable personalized AI responses. 
            The AI will match their unique tone when generating emails and SMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => {
              const toneProfile = toneProfiles.get(profile.id);
              const isAnalyzing = analyzingUserId === profile.id;

              return (
                <Card key={profile.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{profile.first_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                      {toneProfile ? (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not Set
                        </Badge>
                      )}
                    </div>

                    {toneProfile ? (
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground">Formality</p>
                            <p className="font-medium capitalize">{toneProfile.formality_level || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Emoji</p>
                            <p className="font-medium capitalize">{toneProfile.emoji_usage || "None"}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Messages Analyzed</p>
                          <p className="font-medium">
                            {(toneProfile.analyzed_email_count || 0)} emails, {(toneProfile.analyzed_sms_count || 0)} SMS
                          </p>
                        </div>

                        {toneProfile.common_greetings && Array.isArray(toneProfile.common_greetings) && toneProfile.common_greetings.length > 0 && (
                          <div>
                            <p className="text-muted-foreground mb-1">Greetings</p>
                            <div className="flex flex-wrap gap-1">
                              {(toneProfile.common_greetings as string[]).slice(0, 2).map((g, i) => (
                                <Badge key={i} variant="outline" className="text-xs py-0">
                                  {g}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {toneProfile.last_analyzed_at && (
                          <p className="text-muted-foreground pt-1">
                            Updated {formatDistanceToNow(new Date(toneProfile.last_analyzed_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">
                        No tone profile yet. Click analyze to create one.
                      </p>
                    )}

                    <Button
                      onClick={() => handleAnalyzeTone(profile.id, profile.email, profile.first_name)}
                      disabled={isAnalyzing}
                      variant={toneProfile ? "outline" : "default"}
                      size="sm"
                      className="w-full mt-3"
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : toneProfile ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-2" />
                          Re-analyze
                        </>
                      ) : (
                        <>
                          <Brain className="h-3 w-3 mr-2" />
                          Analyze Tone
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
