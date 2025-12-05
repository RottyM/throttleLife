'use server';

import { genkit, z } from 'genkit';
import { googleAI, geminiPro } from '@genkit-ai/googleai';

// Initialize Genkit
const ai = genkit({
  plugins: [googleAI()],
});

// Define the logic for the agent
const agentFlow = ai.defineFlow(
  {
    name: 'motorcycleAgent',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await ai.generate({
      // We switch to geminiPro (1.0) as it has the widest availability
      model: geminiPro, 
      prompt: input,
      system: `You are an expert motorcycle mechanic and safety advisor. 
      Your goal is to help users with repair, maintenance, and safety questions.
      - Always prioritize safety. If a repair is dangerous for a beginner, warn them.
      - Be concise but thorough.
      - If you don't know the answer or if it requires specific manufacturer data you don't have, advise checking the owner's manual.`,
    });
    return text;
  }
);

export const motorcycleAgent = async (input: string) => {
  const response = await agentFlow(input);
  return response;
};
