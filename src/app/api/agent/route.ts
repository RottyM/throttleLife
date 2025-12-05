import { NextRequest, NextResponse } from 'next/server';

async function google_web_search({ query }: { query: string }) {
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await response.json();
    const results = data.RelatedTopics?.slice(0, 5).map((t: any) => ({ title: t.Text?.substring(0, 100), link: t.FirstURL })) || [];
    return { results };
  } catch (error) {
    console.error('Search failed:', error);
    return { results: [] };
  }
}

async function callXAI(prompt: string): Promise<string> {
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    console.log('xAI API response data:', data);
    if (!response.ok) {
      console.error('xAI API error:', response.status, response.statusText, data);
      return 'Fallback response due to API error.';
    }
    return data.choices?.[0]?.message?.content || data.result || data.completion || data.content || 'No valid content in response.';
  } catch (error) {
    console.error('xAI API call failed:', error);
    return `As Grok, built by xAI: ${prompt.split('User\'s question: ')[1] || prompt} - This is a fallback response since the API call failed.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
    }

    let searchResults = '';
    const lowerQuestion = question.toLowerCase();

    // Search for YouTube videos on DIY, repair, safety
    if (lowerQuestion.includes('how to') || lowerQuestion.includes('diy') || lowerQuestion.includes('repair') || lowerQuestion.includes('safety') || lowerQuestion.includes('video')) {
      const videos = await google_web_search({ query: `site:youtube.com motorcycle ${question}` });
      searchResults += `Relevant YouTube Videos: ${JSON.stringify(videos.results)}\n`;
    }

    // Search for articles on safety or general info
    if (lowerQuestion.includes('article') || lowerQuestion.includes('info') || lowerQuestion.includes('safety') || lowerQuestion.includes('guide')) {
      const articles = await google_web_search({ query: `motorcycle ${question} -site:youtube.com` });
      searchResults += `Relevant Articles: ${JSON.stringify(articles.results)}\n`;
    }

    // Search for products/gear
    if (lowerQuestion.includes('product') || lowerQuestion.includes('buy') || lowerQuestion.includes('gear') || lowerQuestion.includes('parts')) {
      const products = await google_web_search({ query: `site:amazon.com motorcycle ${question}` });
      searchResults += `Relevant Products: ${JSON.stringify(products.results)}\n`;
    }

    const prompt = `You are ThrottleBot, an expert motorcycle mechanic and safety instructor powered by xAI (Grok).
Your goal is to provide clear, concise, and helpful advice to motorcycle riders.
You have access to a comprehensive database of motorcycle repair manuals, specs, and safety guidelines.

${searchResults}

When providing information, include links to videos, articles, or products where relevant. Format responses clearly, with sections if needed.

Do not answer questions that are not related to motorcycles.
User's question: "${question}"`;

    const answer = await callXAI(prompt);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}