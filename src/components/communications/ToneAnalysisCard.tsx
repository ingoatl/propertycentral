import { Brain, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToneProfile } from "@/hooks/useToneProfile";
import { formatDistanceToNow } from "date-fns";

export function ToneAnalysisCard() {
  const { profile, isLoading, analyzeTone, isAnalyzing } = useToneProfile();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Tone Profile</CardTitle>
          </div>
          {profile && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Your writing style analyzed from sent messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Formality</p>
                <p className="font-medium capitalize">{profile.formality_level || "Not analyzed"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Emoji Style</p>
                <p className="font-medium capitalize">{profile.emoji_usage || "None"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg. Sentence</p>
                <p className="font-medium">{profile.avg_sentence_length || 0} words</p>
              </div>
              <div>
                <p className="text-muted-foreground">Messages Analyzed</p>
                <p className="font-medium">
                  {(profile.analyzed_email_count || 0) + (profile.analyzed_sms_count || 0)}
                </p>
              </div>
            </div>

            {profile.common_greetings && Array.isArray(profile.common_greetings) && profile.common_greetings.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Common Greetings</p>
                <div className="flex flex-wrap gap-1">
                  {(profile.common_greetings as string[]).slice(0, 3).map((g, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.signature_phrases && Array.isArray(profile.signature_phrases) && profile.signature_phrases.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Signature Phrases</p>
                <div className="flex flex-wrap gap-1">
                  {(profile.signature_phrases as string[]).slice(0, 3).map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      "{p}"
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.last_analyzed_at && (
              <p className="text-xs text-muted-foreground">
                Last updated {formatDistanceToNow(new Date(profile.last_analyzed_at), { addSuffix: true })}
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No tone profile yet. Analyze your sent messages to create one.
            </p>
          </div>
        )}

        <Button
          onClick={() => analyzeTone()}
          disabled={isAnalyzing}
          className="w-full"
          variant={profile ? "outline" : "default"}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Analyzing Messages...
            </>
          ) : profile ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analyze Tone
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Analyze My Writing Style
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
