import { GoogleGenAI } from "@google/genai";
import { AppState, Member, Contribution } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI features will be disabled or mock.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTeamInsights = async (
  members: Member[],
  contributions: Contribution[],
  target: number,
  currency: string
): Promise<string> => {
  const client = getClient();
  if (!client) return "API Key not configured. Please check your environment variables.";

  // Prepare context data
  const currentMonth = new Date().toISOString().substring(0, 7);
  const thisMonthContributions = contributions.filter(c => c.month === currentMonth);
  const totalCollected = thisMonthContributions.reduce((sum, c) => sum + c.amount, 0);
  
  const paidMemberIds = new Set(thisMonthContributions.map(c => c.memberId));
  const unpaidMembers = members.filter(m => !paidMemberIds.has(m.id)).map(m => m.name);
  
  const prompt = `
    You are a helpful and friendly financial assistant for a small team named "TeamFund".
    Analyze the following data for the current month (${currentMonth}):
    
    - Target: ${currency}${target}
    - Collected: ${currency}${totalCollected}
    - Total Members: ${members.length}
    - Unpaid Members: ${unpaidMembers.join(', ') || 'None! Everyone paid.'}
    
    Please provide a response in Markdown format with the following sections:
    1. **Monthly Pulse**: A 2-sentence summary of how the team is doing financially this month.
    2. **Action Items**: Bullet points on what needs to be done (e.g., who to remind, or how to celebrate).
    3. **Team Message**: A drafted, polite, and encouraging message that can be copied and pasted into the team chat (Slack/WhatsApp) to update everyone. If people still owe money, make it a gentle reminder. If everyone paid, make it a celebration.
    
    Keep the tone professional yet casual and motivating.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate insights.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while analyzing the team data. Please try again later.";
  }
};

export const suggestBudgeting = async (
  totalFunds: number,
  currency: string
): Promise<string> => {
   const client = getClient();
  if (!client) return "API Key not configured.";

  const prompt = `
    We have collected ${currency}${totalFunds} in our team fund. 
    Suggest 3 creative and fun ways we could spend this money to boost team morale or productivity. 
    Keep it brief.
  `;

  try {
    const response = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return response.text || "No suggestions available.";
  } catch (error) {
    return "Error generating suggestions.";
  }
}