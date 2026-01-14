
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateSketch = async (prompt: string, currentCode?: string): Promise<string> => {
  const ai = getAI();
  const model = 'gemini-2-5-flash';

  const fullPrompt = currentCode
    ? `Current code:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nTask: ${prompt}\nModify the code accordingly. Return only the full new code.`
    : `Create a p5.js sketch based on this description: ${prompt}. Return only the full code.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    // Clean up markdown code blocks if present
    return text.replace(/```javascript|```js|```/g, '').trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
