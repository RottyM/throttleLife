async function callXAI(prompt: string): Promise<string> {
  try {
    // Direct API call to xAI (Grok)
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.XAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'grok', // Use the appropriate model name
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
    // Fallback to mock response
    return `As Grok, built by xAI: ${prompt.split('User\'s question: ')[1] || prompt} - This is a fallback response since the API call failed.`;
  }
}