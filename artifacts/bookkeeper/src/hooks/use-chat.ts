import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListOpenaiConversations, 
  useGetOpenaiConversation,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
  type OpenaiMessage
} from "@workspace/api-client-react";

export function useConversations() {
  return useListOpenaiConversations();
}

export function useConversation(id: number | null) {
  return useGetOpenaiConversation(id as number, { query: { enabled: !!id } });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useCreateOpenaiConversation({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() })
    }
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useDeleteOpenaiConversation({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() })
    }
  });
}

export function useChatStream(conversationId: number | null) {
  const [messages, setMessages] = useState<OpenaiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();
  const { data: convData } = useConversation(conversationId);

  useEffect(() => {
    if (convData?.messages) {
      setMessages(convData.messages);
    } else {
      setMessages([]);
    }
  }, [convData?.messages]);

  const sendMessage = async (content: string) => {
    if (!conversationId) return;
    
    // Optimistic user message
    const userMsg: OpenaiMessage = {
      id: Date.now(),
      conversationId,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    
    // Optimistic assistant message placeholder
    const assistantMsgId = Date.now() + 1;
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      conversationId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    }]);

    try {
      const res = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (!res.ok) throw new Error("Failed to send message");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error("No reader available");

      let assistantContent = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.content) {
                assistantContent += data.content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, content: assistantContent } : m
                ));
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(conversationId) });
    }
  };

  return { messages, isStreaming, sendMessage };
}
