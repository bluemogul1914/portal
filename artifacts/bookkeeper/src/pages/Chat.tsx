import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useChatStream, useConversations, useCreateConversation } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, MessageSquarePlus, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Chat() {
  const { data: conversations, isLoading: loadingConvs } = useConversations();
  const createConv = useCreateConversation();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  
  const { messages, isStreaming, sendMessage } = useChatStream(activeConvId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversations?.length && !activeConvId) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const startNew = async () => {
    const res = await createConv.mutateAsync({ data: { title: "New Conversation" } });
    setActiveConvId(res.id);
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] lg:h-screen bg-background border-t border-white/5 lg:border-t-0">
        {/* Sidebar for chat history */}
        <div className="w-72 border-r border-white/5 bg-card/30 flex flex-col hidden md:flex">
          <div className="p-4 border-b border-white/5">
            <Button onClick={startNew} disabled={createConv.isPending} className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none">
              <MessageSquarePlus className="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingConvs ? (
                [1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
              ) : (
                conversations?.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${activeConvId === c.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                  >
                    <MessageSquare className="w-4 h-4 opacity-70" />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-[#090E1A]">
          {/* Header */}
          <div className="h-16 flex items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Max - AI Bookkeeper</h2>
                <p className="text-xs text-muted-foreground">Always ready to help</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollRef}>
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
              {messages.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-lg shadow-primary/10">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Hello, I'm Max.</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Your AI bookkeeping assistant. Ask me about your cash flow, how to categorize expenses, or tax advice!
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-4 animate-in slide-in-from-bottom-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground rounded-tr-sm' : 'bg-card border border-white/5 text-foreground rounded-tl-sm'}`}>
                    {msg.content || (isStreaming && msg.role === 'assistant' ? <span className="animate-pulse">Thinking...</span> : "")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSend} className="relative flex items-center glass-panel rounded-2xl p-1 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Max a question..."
                  className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-4 h-12 text-foreground"
                  disabled={isStreaming || !activeConvId}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isStreaming || !activeConvId} className="h-10 w-10 rounded-xl mr-1 shrink-0 bg-primary hover:bg-primary/90">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <div className="text-center mt-2 text-[10px] text-muted-foreground opacity-50">
                AI can make mistakes. Verify important financial data.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
