/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

let aiInstance: any = null;

export function getGemini() {
  if (!aiInstance && API_KEY) {
    aiInstance = new GoogleGenAI({ apiKey: API_KEY });
  }
  return aiInstance;
}

export async function askStrategicArchitect(prompt: string, context: any) {
  const ai = getGemini();
  if (!ai) return "AI Service not configured.";

  const systemInstruction = `
You are the Strategic Architect inside TL Master, a resource management platform.
Current live data: ${JSON.stringify(context)}

STRICT RULES:
- Answer in plain text only. No markdown, no hashtags, no asterisks, no bold formatting.
- Be concise. Maximum 4 sentences or 4 bullet lines.
- Lead with the direct answer, then one or two supporting data points.
- Use numbers from the context when relevant.
- Never explain your reasoning process. Just answer.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const raw = response.text || "I'm sorry, I couldn't generate a response.";
    // Strip any markdown that leaked through despite instructions
    return raw
      .replace(/#{1,6}\s*/g, '')          // headings
      .replace(/\*\*(.*?)\*\*/g, '$1')    // bold
      .replace(/\*(.*?)\*/g, '$1')        // italic
      .replace(/`{1,3}(.*?)`{1,3}/gs, '$1') // code
      .replace(/^\s*[-•]\s+/gm, '• ')    // normalise bullets
      .trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error communicating with the Strategic Architect.";
  }
}
