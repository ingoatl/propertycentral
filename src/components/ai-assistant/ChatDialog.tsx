import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, Sparkles, Paperclip, Smile } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatDialog = ({ open, onOpenChange }: ChatDialogProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI Property Assistant. I can help you find information about your properties, bookings, expenses, email insights, and more.\n\nTry asking me things like:\n• \"What's the WiFi password for Villa 15?\"\n• \"Show me expenses for this month\"\n• \"What bookings do we have coming up?\"\n• \"What's the access code for [property name]?\"\n\nWhat would you like to know?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-property-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(`Failed to get response: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content" && parsed.content) {
              assistantMessage += parsed.content;
              setMessages([...newMessages, { role: "assistant", content: assistantMessage }]);
            }
          } catch (e) {
            console.error("Error parsing stream:", e, "Data:", data);
          }
        }
      }

      if (buffer.trim()) {
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (!line.trim() || line.startsWith(":") || !line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content" && parsed.content) {
              assistantMessage += parsed.content;
              setMessages([...newMessages, { role: "assistant", content: assistantMessage }]);
            }
          } catch (e) {
            console.error("Error parsing final buffer:", e);
          }
        }
      }

      if (!assistantMessage) {
        setMessages([...newMessages, { 
          role: "assistant", 
          content: "I apologize, but I encountered an issue processing your request. Please try again." 
        }]);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to get response. Please try again.");
      setMessages([...newMessages, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 max-md:h-screen max-md:max-w-full">
        <DialogHeader className="px-6 py-4 border-b max-md:px-4">
          <DialogTitle className="flex items-center gap-2 max-md:text-xl">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            AI Property Assistant
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 max-md:px-4" ref={scrollRef}>
          <div className="space-y-4 max-md:space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[80%] max-md:px-3 max-md:py-3 ${
                    message.role === "assistant"
                      ? "bg-muted"
                      : "bg-gradient-to-br from-violet-500 to-violet-600 text-white"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap max-md:text-base">{message.content}</p>
                </div>
                {message.role === "user" && (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-white">You</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t max-md:px-4 max-md:py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about properties, bookings, expenses..."
                disabled={isLoading}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0 h-8 max-md:h-10 max-md:text-base"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Smile className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
