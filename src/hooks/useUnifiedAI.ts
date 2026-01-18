import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UnifiedAIRequest {
  action: 'compose' | 'reply' | 'improve' | 'shorten' | 'professional' | 'friendly';
  messageType: 'sms' | 'email';
  contactType: 'lead' | 'owner';
  contactId: string;
  currentMessage?: string;
  incomingMessage?: string;
  userInstructions?: string;
  includeCalendarLink?: boolean;
  includeIncomeOffer?: boolean;
  subject?: string;
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
        console.log('AI Response Quality Issues:', response.validationIssues);
      }

      return response;
    } catch (error) {
      console.error('Unified AI Error:', error);
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
    contactType: 'lead' | 'owner',
    contactId: string,
    messageType: 'sms' | 'email',
    instructions?: string
  ) => {
    return generateResponse({
      action: 'compose',
      messageType,
      contactType,
      contactId,
      userInstructions: instructions,
    });
  };

  const replyToMessage = (
    contactType: 'lead' | 'owner',
    contactId: string,
    messageType: 'sms' | 'email',
    incomingMessage: string,
    instructions?: string
  ) => {
    return generateResponse({
      action: 'reply',
      messageType,
      contactType,
      contactId,
      incomingMessage,
      userInstructions: instructions,
    });
  };

  const improveMessage = (
    contactType: 'lead' | 'owner',
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string
  ) => {
    return generateResponse({
      action: 'improve',
      messageType,
      contactType,
      contactId,
      currentMessage,
    });
  };

  const shortenMessage = (
    contactType: 'lead' | 'owner',
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string
  ) => {
    return generateResponse({
      action: 'shorten',
      messageType,
      contactType,
      contactId,
      currentMessage,
    });
  };

  const makeProfessional = (
    contactType: 'lead' | 'owner',
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string
  ) => {
    return generateResponse({
      action: 'professional',
      messageType,
      contactType,
      contactId,
      currentMessage,
    });
  };

  const makeFriendly = (
    contactType: 'lead' | 'owner',
    contactId: string,
    messageType: 'sms' | 'email',
    currentMessage: string
  ) => {
    return generateResponse({
      action: 'friendly',
      messageType,
      contactType,
      contactId,
      currentMessage,
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
