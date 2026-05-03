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
    You are the "Strategic Architect" for TL Master, an AI-powered resource management platform.
    Your goal is to help Team Leads optimize team assembly and manage risks.

    You have access to current staffing data:
    ${JSON.stringify(context)}

    Respond to user queries with professional, data-backed insights. 
    Focus on billability gaps, over/under utilization, and staffing risks.
    Explain your reasoning (e.g., "Checking CVs... checking ML-adjusted availability...").
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error communicating with the Strategic Architect.";
  }
}
