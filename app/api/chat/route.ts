import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// ================================================================
// MOCK MODE — true = instant demo, false = real Gemini API
// ================================================================
const MOCK_MODE = true;

// ================================================================
// SYSTEM PROMPT
// ================================================================
const SYSTEM_PROMPT = `You are PlanGo, a highly advanced bilingual AI lifestyle concierge.
Your job is to understand the user's outing request and ask clarifying questions to build a perfect itinerary.
Focus on these specific categories: 
1. Departure Time (AM/PM/Night)
2. Location (Domestic/Overseas)
3. Travel Vibe (Romantic, Family, Adventure, Chill, Shopping, Culture)
4. Budget Range
5. Dietary Needs (Strictly ask if they need Halal, Vegetarian, or Mixed)
6. Transport (Grab, Public Transit, Own Car)

Ask a MAXIMUM of 2 questions per reply. Keep your tone friendly, concise, and highly professional.
Always reply in the exact same language the user is using (English or Chinese).
Once you have enough context, confidently state that you are generating the ultimate itinerary.`;

// ================================================================
// MOCK RESPONSES (Synced with Frontend QnA)
// ================================================================
const MOCK_ROUNDS: Record<number, Record<string, string>> = {
  1: {
    en: "Got it! To make this perfect, what time are you planning to head out, and what's your rough budget?",
    zh: "好的，交给我！为了安排得更完美，请问你们大概几点出发？预算范围大概是多少？",
  },
  2: {
    en: "Noted. Are there any dietary restrictions (like Halal or Vegetarian), and what's your preferred travel vibe?",
    zh: "记下了。请问有任何饮食限制吗（比如需要清真 Halal 或素食）？另外这次出游想要什么氛围（休闲、探险、亲子）？",
  },
  3: {
    en: "Perfect, I have all the details I need. Generating your ultimate executable plan now... ✨",
    zh: "太完美了，我已经掌握了所有细节！正在为您生成终极可执行行程... ✨",
  },
};

// ================================================================
// MAIN HANDLER
// ================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body.messages ?? [];
    const lang: string = body.lang ?? "zh";

    // ── MOCK MODE ──────────────────────────────────────────────
    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 900)); // Simulate AI typing delay

      const userCount = messages.filter((m) => m.role === "user").length;
      const round = Math.min(userCount, 3) as 1 | 2 | 3;
      const content = MOCK_ROUNDS[round]?.[lang] ?? MOCK_ROUNDS[3][lang];

      return NextResponse.json({ content });
    }

    // ── REAL GEMINI API ────────────────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { content: lang === "en" ? "Gemini API key not configured." : "Gemini API 密钥未配置。" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Build Gemini-format history
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const userPrompt = lastMessage?.content ?? "";

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 512,
      },
      history,
    });

    const response = await chat.sendMessage({ message: userPrompt });
    const text = response.text ?? (lang === "en" ? "Let me think..." : "让我想想...");

    return NextResponse.json({ content: text });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { content: "Something went wrong. Please try again. 🙏" },
      { status: 500 }
    );
  }
}