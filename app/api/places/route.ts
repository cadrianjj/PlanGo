import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const MOCK_MODE = true;

// ================================================================
// MOCK PLACES DATA (Kuala Lumpur Context)
// ================================================================
const MOCK_PLACES: Record<string, object[]> = {
  restaurant: [
    {
      id: "mock_r1",
      name: { en: "Deen Nasi Kandar KL", zh: "Deen 扁担饭 (KL分店)" },
      address: "Jalan Tuanku Abdul Rahman, Kuala Lumpur",
      rating: 4.6,
      category: "Halal / Local",
      price_per_person: 25,
      available: true,
      queue_time: 15,
      tags: ["Halal", "Must-eat", "Queue expected"],
    },
    {
      id: "mock_r2",
      name: { en: "Madam Kwan's Pavilion", zh: "关夫人餐厅 (Pavilion)" },
      address: "Pavilion KL, Bukit Bintang, Kuala Lumpur",
      rating: 4.5,
      category: "Local / Mixed",
      price_per_person: 45,
      available: true,
      queue_time: 20,
      tags: ["Air-con", "Family-friendly", "Nasi Lemak"],
    },
  ],
  activity: [
    {
      id: "mock_a1",
      name: { en: "Aquaria KLCC", zh: "吉隆坡城中城水族馆" },
      address: "Kuala Lumpur Convention Centre",
      rating: 4.7,
      category: "Attraction",
      price_per_person: 75,
      available: true,
      queue_time: 5,
      tags: ["Indoor", "Family", "Rain-proof"],
    },
  ],
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword") || "";
    const category = searchParams.get("category") || "restaurant";

    // ── MOCK MODE ──────────────────────────────────────────────
    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 600));
      const results = MOCK_PLACES[category] || MOCK_PLACES["restaurant"];
      return NextResponse.json({ status: "mock", keyword, results });
    }

    // ── REAL GOOGLE PLACES API ─────────────────────────────────
    if (!process.env.GOOGLE_MAPS_API_KEY) throw new Error("Missing Maps Key");

    const response = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      { textQuery: keyword },
      {
        headers: {
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating",
        }
      }
    );

    return NextResponse.json({
      status: "real",
      keyword,
      results: response.data.places || [],
    });

  } catch (error) {
    console.error("Places API error:", error);
    return NextResponse.json({ error: "Places search failed" }, { status: 500 });
  }
}