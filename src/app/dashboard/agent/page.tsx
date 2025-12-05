'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle } from 'lucide-react';

export default function AgentPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setAnswer('');

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      const data = await res.json();
      setAnswer(data.answer);
    } catch (error) {
      setAnswer(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🤖</span>
            ThrottleBot - AI Motorcycle Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="question" className="block text-sm font-medium mb-2">
                Ask your motorcycle question:
              </label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., How to change motorcycle oil?"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !question.trim()}>
              {loading ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                'Ask ThrottleBot'
              )}
            </Button>
          </form>

          {answer && (
            <div>
              <label className="block text-sm font-medium mb-2">
                ThrottleBot's Answer:
              </label>
              <Textarea
                value={answer}
                readOnly
                className="min-h-32"
                placeholder="Answer will appear here..."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}