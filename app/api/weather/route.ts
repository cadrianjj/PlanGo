import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const MOCK_MODE = true;

// Change scenario to: "sunny" | "rainy" | "hot" to test frontend UI triggers
const CURRENT_SCENARIO = "rainy"; 

const MOCK_WEATHER: Record<string, any> = {
  sunny: {
    status: "mock",
    condition: { en: "Partly Cloudy", zh: "多云转晴" },
    temp: "31°C",
    alert: null,
    outdoor_ok: true,
  },
  rainy: {
    status: "mock",
    condition: { en: "Thunderstorms", zh: "雷阵雨" },
    temp: "27°C",
    // This alert triggers the replan engine in your UI
    alert: { en: "Heavy rain expected after 3 PM. Suggest indoor fallback.", zh: "下午3点后有雷阵雨，建议切换室内备选方案。" },
    outdoor_ok: false,
  },
  hot: {
    status: "mock",
    condition: { en: "Extremely Hot", zh: "高温暴晒" },
    temp: "36°C",
    alert: { en: "Heatwave warning. Avoid outdoor walks during noon.", zh: "高温预警！中午尽量避免户外步行。" },
    outdoor_ok: false,
  },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || "Kuala Lumpur";

    // ── MOCK MODE ──────────────────────────────────────────────
    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 400));
      const weather = MOCK_WEATHER[CURRENT_SCENARIO];
      return NextResponse.json({ city, ...weather });
    }

    // ── REAL WEATHER API (OpenWeatherMap) ──────────────────────
    if (!process.env.OPENWEATHER_API_KEY) throw new Error("Missing Weather Key");

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: city,
          appid: process.env.OPENWEATHER_API_KEY,
          units: "metric"
        },
      }
    );

    const isRaining = response.data.weather[0].main.toLowerCase().includes("rain");

    return NextResponse.json({
      status: "real",
      city,
      condition: response.data.weather[0].description,
      temp: `${Math.round(response.data.main.temp)}°C`,
      alert: isRaining ? "Rain detected. Indoor fallback recommended." : null,
      outdoor_ok: !isRaining,
    });

  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 500 });
  }
}