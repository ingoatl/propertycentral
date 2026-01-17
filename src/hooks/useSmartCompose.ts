import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SmartComposeOptions {
  action: "compose" | "improve" | "reply" | "bullets";
  messageType: "email" | "sms";
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  currentContent?: string;
  bullets?: string[];
  replyToContent?: string;
  subject?: string;
}

export function useSmartCompose() {
  const compose = useMutation({
    mutationFn: async (options: SmartComposeOptions) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("smart-compose", {
        body: {
          ...options,
          user_id: user?.id,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error(`AI composition failed: ${error.message}`);
    },
  });

  const composeFromBullets = async (
    bullets: string[],
    messageType: "email" | "sms",
    contactName?: string,
    contactEmail?: string
  ) => {
    return compose.mutateAsync({
      action: "bullets",
      messageType,
      bullets,
      contactName,
      contactEmail,
    });
  };

  const improveMessage = async (
    currentContent: string,
    messageType: "email" | "sms",
    contactName?: string
  ) => {
    return compose.mutateAsync({
      action: "improve",
      messageType,
      currentContent,
      contactName,
    });
  };

  const generateReply = async (
    replyToContent: string,
    messageType: "email" | "sms",
    contactName?: string,
    contactEmail?: string,
    contactPhone?: string
  ) => {
    return compose.mutateAsync({
      action: "reply",
      messageType,
      replyToContent,
      contactName,
      contactEmail,
      contactPhone,
    });
  };

  return {
    compose: compose.mutateAsync,
    composeFromBullets,
    improveMessage,
    generateReply,
    isLoading: compose.isPending,
  };
}
