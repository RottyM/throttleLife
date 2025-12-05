'use server';
/**
 * @fileOverview A simple xAI (Grok) powered agent for motorcycle questions.
 */

async function callXAI(prompt: string): Promise<string> {
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.XAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'grok',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`xAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('xAI API response data:', data);
    return data.choices?.[0]?.message?.content || data.result || data.completion || data.content || 'No valid content in response.';
  } catch (error) {
    console.error('xAI API call failed:', error);
    return `As Grok, built by xAI: ${prompt.split('User\'s question: ')[1] || prompt} - This is a fallback response since the API call failed.`;
  }
}

export async function motorcycleAgent(question: string): Promise<string> {
  const prompt = `You are ThrottleBot, an expert motorcycle mechanic and safety instructor powered by xAI (Grok).
Your goal is to provide clear, concise, and helpful advice to motorcycle riders.
You have access to a comprehensive database of motorcycle repair manuals, specs, and safety guidelines.

Do not answer questions that are not related to motorcycles.
User's question: "${question}"`;

  return callXAI(prompt);
}