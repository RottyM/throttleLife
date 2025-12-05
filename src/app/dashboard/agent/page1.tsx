'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoaderCircle, User, Bot, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'agent';
  content: string;
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input }),
      });
      const data = await res.json();
      const response = data.answer || data.error || 'Error occurred';
      const agentMessage: Message = { role: 'agent', content: response };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error calling motorcycle agent:', error);
      const errorMessage: Message = {
        role: 'agent',
        content: "Sorry, I'm having trouble connecting to my knowledge base right now. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
          xAI Motorcycle Agent
        </h1>
        <p className="text-muted-foreground">
          Your personal expert for motorcycle repair and safety, powered by xAI (Grok).
        .
        </p>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-4',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'agent' && (
                    <Avatar className="h-9 w-9 border">
                      <AvatarFallback>
                        <Bot />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'prose max-w-prose rounded-lg p-3 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                   {message.role === 'user' && (
                     <Avatar className="h-9 w-9 border">
                      <AvatarFallback>
                        <User />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
               {isLoading && (
                <div className="flex items-start gap-4">
                  <Avatar className="h-9 w-9 border">
                      <AvatarFallback>
                        <Bot />
                      </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center space-x-2 rounded-lg bg-muted p-3">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="border-t bg-background p-4">
            <form onSubmit={handleSendMessage} className="mx-auto flex max-w-3xl items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about torque specs, safety checks, DIY repairs, or anything motorcycle-related..."
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}