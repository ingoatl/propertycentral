import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ContactType = 'lead' | 'owner' | 'vendor';

export interface UnifiedAIRequest {
  action: 'compose' | 'reply' | 'improve' | 'shorten' | 'professional' | 'friendly';
  messageType: 'sms' | 'email';
  contactType: ContactType;
  contactId: string;
  currentMessage?: string;
  incomingMessage?: string;
  userInstructions?: string;
  includeCalendarLink?: boolean;
  includeIncomeOffer?: boolean;
  subject?: string;
  // NEW: Pass the full conversation thread for context
  conversationThread?: Array<{
    direction: string;
    body: string;
    created_at: string;
    type?: string;
    subject?: string;
  }>;
  // NEW: Additional identifiers for fallback lookup
  ghlContactId?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface UnifiedAIResponse {
  success: boolean;
  message: string;
  subject?: string;
  qualityScore: number;
  validationIssues: string[];
  contextUsed: {
    memoriesCount: number;
    knowledgeEntriesUsed: string[];
    questionsAnswered: number;
    sentimentDetected: string;
    conversationPhase: string;
    messagesAnalyzed?: number;
  };
  metadata: {
    model: string;
    generationTimeMs: number;
  };
}

export function useUnifiedAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<UnifiedAIResponse | null>(null);

  const generateResponse = async (request: UnifiedAIRequest): Promise<UnifiedAIResponse | null> => {
    setIsLoading(true);
    
    try {
      console.log('[useUnifiedAI] Generating response with request:', {
        action: request.action,
        messageType: request.messageType,
        contactType: request.contactType,
        contactId: request.contactId,
        threadLength: request.conversationThread?.length || 0,
        hasIncomingMessage: !!request.incomingMessage,
      });

      const { data, error } = await supabase.functions.invoke('unified-ai-compose', {
        body: request,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'AI generation failed');
      }

      const response = data as UnifiedAIResponse;
      setLastResponse(response);

      // Show quality feedback if there are issues
      if (response.validationIssues.length > 0) {
        console.log('[useUnifiedAI] Quality Issues:', response.validationIssues);
      }
      
      console.log('[useUnifiedAI] Generated response:', {
        qualityScore: response.qualityScore,
        messagesAnalyzed: response.contextUsed.messagesAnalyzed,
        sentimentDetected: response.contextUsed.sentimentDetected,
      });

      return response;
    } catch (error) {
      console.error('[useUnifiedAI] Error:', error);
      toast({
        title: 'AI Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate response',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Convenience methods for common actions
  const composeMessage = (
    contactType: ContactType,
    contactId: string,
    messageType: 'sms' | 'email',
    instructions?: string,
    conversationThread?: UnifiedAIRequest['conversationThread'],
    contactPhone?: string,
    contactEmail?: string
  ) => {
    return generateResponse({
      action: 'compose',
      messageType,
      contactType,
      contactId,
      userInstructions: instructions,
      conversationThread,
      contactPhone,
      contactEmail,
    });
  };

  const replyToMessage = (
    contactType: ContactType,
    contactId: string,
    messageType: 'sms' | 'email',
    incomingMessage: string,
    instructions?: string,
    conversationThread?: UnifiedAIRequest['conversationThread'],
    contactPhone?: string,
    contactEmail?: string,
    ghlContactId?: string
  ) => {
    return generateResponse({
      action: 'reply',
      messageType,
      contactType,
      contactId,
      incomingMessage,
      userInstructions: instructions,
      conversationThread,
      contactPhone,
      contactEmail,
      ghlContactId,
    });
  };

  const improveMessage = (
    contactType: ContactType,
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string,
    conversationThread?: UnifiedAIRequest['conversationThread']
  ) => {
    return generateResponse({
      action: 'improve',
      messageType,
      contactType,
      contactId,
      currentMessage,
      conversationThread,
    });
  };

  const shortenMessage = (
    contactType: ContactType,
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string,
    conversationThread?: UnifiedAIRequest['conversationThread']
  ) => {
    return generateResponse({
      action: 'shorten',
      messageType,
      contactType,
      contactId,
      currentMessage,
      conversationThread,
    });
  };

  const makeProfessional = (
    contactType: ContactType,
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string,
    conversationThread?: UnifiedAIRequest['conversationThread']
  ) => {
    return generateResponse({
      action: 'professional',
      messageType,
      contactType,
      contactId,
      currentMessage,
      conversationThread,
    });
  };

  const makeFriendly = (
    contactType: ContactType,
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string,
    conversationThread?: UnifiedAIRequest['conversationThread']
  ) => {
    return generateResponse({
      action: 'friendly',
      messageType,
      contactType,
      contactId,
      currentMessage,
      conversationThread,
    });
  };

  // Track when user sends the response (for quality learning)
  const trackResponseSent = async (
    qualityRecordId: string,
    finalResponse: string,
    wasSentAsIs: boolean
  ) => {
    try {
      // Calculate edit distance (simple version)
      const editDistance = wasSentAsIs ? 0 : calculateEditDistance(
        lastResponse?.message || '',
        finalResponse
      );

      await supabase
        .from('ai_response_quality')
        .update({
          final_response: finalResponse,
          was_sent_as_is: wasSentAsIs,
          edit_distance: editDistance,
        })
        .eq('id', qualityRecordId);
    } catch (error) {
      console.error('Failed to track response:', error);
    }
  };

  return {
    isLoading,
    lastResponse,
    generateResponse,
    composeMessage,
    replyToMessage,
    improveMessage,
    shortenMessage,
    makeProfessional,
    makeFriendly,
    trackResponseSent,
  };
}

// Simple Levenshtein distance calculation
function calculateEditDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Use simplified calculation for performance
  if (m === 0) return n;
  if (n === 0) return m;
  
  // Quick check if strings are identical
  if (str1 === str2) return 0;
  
  // Calculate based on length difference and sample comparison
  const lengthDiff = Math.abs(m - n);
  const sampleSize = Math.min(100, Math.min(m, n));
  let sampleDiff = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    if (str1[i] !== str2[i]) sampleDiff++;
  }
  
  // Estimate total edit distance
  return lengthDiff + Math.round((sampleDiff / sampleSize) * Math.max(m, n));
}
