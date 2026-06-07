"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, HelpCircle, CalendarClock, Wallet, Briefcase,
  ShieldAlert, BookOpen, Share2, PlayCircle, RefreshCcw,
  BrainCircuit, Flag, ChevronRight, Plus, Minus, MapPin,
  Clock, Users, Send, CheckCircle2, Undo2, Hospital,
  ShieldCheck, Ambulance, Star, Phone, Navigation,
  Utensils, Camera, Heart, Mountain, ShoppingBag,
  Music, Palmtree, Globe, Zap, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle, Info, Flame, ThumbsUp, ThumbsDown
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
type Lang = "en" | "zh";
type Currency = "MYR" | "CNY" | "USD" | "SGD" | "JPY" | "EUR" | "THB";
type PageId = "planner" | "qna" | "main" | "memory" | "recap";

type Bilingual = { en: string; zh: string };

interface Stop {
  id: string;
  time: string;
  endTime: string;
  place: Bilingual;
  type: "transport" | "activity" | "food" | "walk" | "hotel";
  notes: Bilingual;
  why: Bilingual;
  cost: number;
  address: string;
  transport: string;
  travelMin: number;
  indoor: boolean;
  mapLink: string;
  rating?: number;
  menu?: string[];
  phone?: string;
  seats?: { time: string; available: number }[];
  xhsScore?: number;
  xhsLabel?: Bilingual;
  adSponsored?: boolean;
  image?: string;
  queueTime?: number;
}

interface Plan {
  summary: Bilingual;
  schedule: Stop[];
  totalCost: number;
  perPerson: number;
  people: number;
  days: number;
  currency: Currency;
  packing: { category: Bilingual; items: { en: string; zh: string; qty?: string }[] }[];
  emergency: { label: Bilingual; number: string; icon: string }[];
  notes: { icon: string; label: Bilingual; value: Bilingual }[];
  summaryMessage: Bilingual;
}

const CURRENCIES: Record<Currency, { symbol: string; rate: number; name: string }> = {
  MYR: { symbol: "RM",  rate: 1,       name: "Malaysian Ringgit" },
  CNY: { symbol: "¥",   rate: 1.56,    name: "Chinese Yuan" },
  USD: { symbol: "$",   rate: 0.21,    name: "US Dollar" },
  SGD: { symbol: "S$",  rate: 0.29,    name: "Singapore Dollar" },
  JPY: { symbol: "¥",   rate: 32.4,    name: "Japanese Yen" },
  EUR: { symbol: "€",   rate: 0.20,    name: "Euro" },
  THB: { symbol: "฿",   rate: 7.5,     name: "Thai Baht" },
};

const fmt = (v: number, cur: Currency) => {
  const { symbol, rate } = CURRENCIES[cur];
  const val = Math.round(v * rate);
  return `${symbol}${val.toLocaleString()}`;
};

export function shiftTimeStr(time: string | undefined | null, offsetMin: number): string {
  if (!time || typeof time !== 'string') return "TBD";
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time;
  try {
    let h = Number(match[1]); 
    const m = Number(match[2]); 
    const sfx = match[3].toUpperCase();
    if (sfx === "PM" && h !== 12) h += 12;
    if (sfx === "AM" && h === 12) h = 0;
    const d = new Date(2026, 0, 1, h, m + offsetMin);
    let nh = d.getHours(); 
    const ns = nh >= 12 ? "PM" : "AM"; 
    nh = nh % 12 || 12;
    return `${nh}:${String(d.getMinutes()).padStart(2, "0")} ${ns}`;
  } catch (e) {
    return time;
  }
}

// ─────────────────────────────────────────────────────────────────
// LOCATION DATA
// ─────────────────────────────────────────────────────────────────
const WORLD = [
  { continent: "Asia 🌏", countries: [
    { name: "China 🇨🇳", cities: ["Beijing","Shanghai","Guangzhou","Chengdu","Shenzhen"], emergencyBase: { police:"110", ambulance:"120", fire:"119", tourist:"12301", highway:"12122" }, currency:"CNY" as Currency },
    { name: "Malaysia 🇲🇾", cities: ["Kuala Lumpur","Penang","Johor Bahru","Kota Kinabalu","Melaka"], emergencyBase: { police:"999", ambulance:"999", fire:"994", tourist:"+603-2149 6590", highway:"1800-88-7752" }, currency:"MYR" as Currency },
    { name: "Japan 🇯🇵", cities: ["Tokyo","Osaka","Kyoto","Sapporo","Fukuoka"], emergencyBase: { police:"110", ambulance:"119", fire:"119", tourist:"03-3201-3331", highway:"#9910" }, currency:"JPY" as Currency },
    { name: "Singapore 🇸🇬", cities: ["Singapore"], emergencyBase: { police:"999", ambulance:"995", fire:"995", tourist:"1800-736-2000", highway:"1800-225-5582" }, currency:"SGD" as Currency },
    { name: "Thailand 🇹🇭", cities: ["Bangkok","Chiang Mai","Phuket","Pattaya"], emergencyBase: { police:"191", ambulance:"1669", fire:"199", tourist:"1155", highway:"1193" }, currency:"THB" as Currency },
  ]},
  { continent: "Europe 🌍", countries: [
    { name: "France 🇫🇷", cities: ["Paris","Lyon","Nice","Bordeaux"], emergencyBase: { police:"17", ambulance:"15", fire:"18", tourist:"+33 1 40 20 53 17", highway:"3605" }, currency:"EUR" as Currency },
    { name: "Germany 🇩🇪", cities: ["Berlin","Munich","Hamburg","Frankfurt"], emergencyBase: { police:"110", ambulance:"112", fire:"112", tourist:"+49 30 250025", highway:"0800 7 22 62 22" }, currency:"EUR" as Currency },
  ]},
  { continent: "Americas 🌎", countries: [
    { name: "USA 🇺🇸", cities: ["New York","Los Angeles","Chicago","Miami","Las Vegas"], emergencyBase: { police:"911", ambulance:"911", fire:"911", tourist:"1-800-USA-INFO", highway:"511" }, currency:"USD" as Currency },
  ]},
];

const CITY_IMAGES: Record<string, string> = {
  "Kuala Lumpur": "🏙️", "Penang": "🌊", "Johor Bahru": "🌃",
  "Tokyo": "🗼", "Osaka": "🏯", "Kyoto": "⛩️", "Paris": "🗼",
  "New York": "🗽", "Bangkok": "🛕", "Singapore": "🦁",
  "Beijing": "🏯", "Shanghai": "🌆", "Guangzhou": "🌆", "Shenzhen": "🏙️", "Chengdu": "🐼"
};

const VIBE_DATA = [
  { id:"romantic",  icon:"💕", label:{en:"Romantic",       zh:"浪漫约会"},  color:"#ff6b9d", img:"💑" },
  { id:"family",    icon:"👨‍👩‍👧",  label:{en:"Family Fun",     zh:"亲子同乐"},  color:"#ffaa00", img:"🎠" },
  { id:"adventure", icon:"🏃", label:{en:"Adventure",      zh:"户外探险"},  color:"#22c55e", img:"⛰️" },
  { id:"chill",     icon:"🍜", label:{en:"Chill & Food",   zh:"吃喝躺平"},  color:"#3b82f6", img:"🛋️" },
  { id:"culture",   icon:"🎨", label:{en:"Culture",        zh:"文化探索"},  color:"#a855f7", img:"🏛️" },
  { id:"shopping",  icon:"🛍️", label:{en:"Shopping",       zh:"疯狂购物"},  color:"#ec4899", img:"👜" },
  { id:"nightlife", icon:"🎵", label:{en:"Nightlife",      zh:"夜生活"},    color:"#6366f1", img:"🌃" },
  { id:"healing",   icon:"💔", label:{en:"Healing Trip",   zh:"疗愈失恋"},  color:"#64748b", img:"🌸" },
  { id:"luxury",    icon:"💎", label:{en:"Luxury",         zh:"豪华享受"},  color:"#f59e0b", img:"🏆" },
  { id:"nature",    icon:"🌿", label:{en:"Nature",         zh:"亲近自然"},  color:"#10b981", img:"🌲" },
];

const BUDGET_TIERS = [
  { id:"backpacker", icon:"🎒", label:{en:"Budget",  zh:"背包客"},   min:0, max:150,  img:"🏕️" },
  { id:"comfort",    icon:"🏨", label:{en:"Comfort", zh:"舒适出行"}, min:150, max:450,img:"🛏️" },
  { id:"luxury",     icon:"💎", label:{en:"Luxury",  zh:"豪华享受"}, min:450, max:0,  img:"🏰" },
];

// ─────────────────────────────────────────────────────────────────
// MOCK PLAN BUILDER
// ─────────────────────────────────────────────────────────────────
function buildMockPlan(city: string, people: number, days: number, cur: Currency, vibes: string[], budgetTier: string): Plan {
  const isFamily  = vibes.includes("family");
  const isRomantic = vibes.includes("romantic");
  const isLuxury  = budgetTier === "luxury";
  const isChina = city === "Beijing" || city === "Shanghai" || city === "Guangzhou" || city === "Shenzhen" || cur === "CNY";

  const MOCK_RESTAURANTS = isChina ? [
    { name: "Wangfujing Snack Street", rating: 4.6, cuisine: "Chinese", menu: ["Baozi", "Tanghulu", "Noodles"], phone: "+86-10-12345678", seats: [{time:"6:00 PM",available:8},{time:"7:00 PM",available:3},{time:"8:00 PM",available:12}], adSponsored: true },
    { name: "Quanjude Roast Duck",    rating: 4.9, cuisine: "Beijing", menu: ["Peking Duck", "Duck Soup"], phone: "+86-10-88888888", seats: [{time:"7:00 PM",available:2},{time:"8:30 PM",available:6},{time:"9:00 PM",available:4}], adSponsored: false },
    { name: "Haidilao Hotpot",  rating: 4.8, cuisine: "Hotpot", menu: ["Spicy Broth", "Beef Slices"], phone: "+86-10-99999999", seats: [{time:"6:30 PM",available:5},{time:"7:30 PM",available:9}], adSponsored: false },
  ] : [
    { name: "Jalan Alor Street Food", rating: 4.7, cuisine: "Malaysian", menu: ["Char Kway Teow", "Hokkien Mee", "Satay"], phone: "+603-2148 7888", seats: [{time:"6:00 PM",available:8},{time:"7:00 PM",available:3},{time:"8:00 PM",available:12}], adSponsored: true },
    { name: "Atmosphere 360 KLCC",    rating: 4.8, cuisine: "International", menu: ["Wagyu Beef", "Lobster Thermidor", "Teh Tarik Crème Brûlée"], phone: "+603-2020 2020", seats: [{time:"7:00 PM",available:2},{time:"8:30 PM",available:6},{time:"9:00 PM",available:4}], adSponsored: false },
    { name: "Limapulo Authentic KL",  rating: 4.5, cuisine: "Heritage", menu: ["Nasi Lemak", "Beef Rendang", "Pulut Inti"], phone: "+603-2692 3588", seats: [{time:"6:30 PM",available:5},{time:"7:30 PM",available:9}], adSponsored: false },
  ];

  const restaurant = MOCK_RESTAURANTS[isLuxury ? 1 : isRomantic ? 1 : 0];

  const schedule: Stop[] = [
    {
      id: "depart", time: "2:00 PM", endTime: "2:25 PM",
      place: { en: "Grab/Didi from hotel", zh: isChina ? "从酒店叫专车出发" : "从酒店叫 Grab 出发" },
      type: "transport", notes: { en: "Booked ahead, child seat confirmed", zh: "已提前预约专车，确保不折腾" },
      why: { en: "Fastest & stress-free pickup", zh: "最便捷无压力的出行方式" },
      cost: 18, address: "Starting point", transport: isChina ? "Didi" : "Grab",
      travelMin: 25, indoor: false, mapLink: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(city)}&travelmode=driving`,
      image: "🚗",
    },
    {
      id: "activity", time: "2:35 PM", endTime: "4:10 PM",
      place: isFamily
        ? (isChina ? { en: `Universal Studios ${city}`, zh: `${city}环球影城亲子游` } : { en: `KidZania ${city}`, zh: `KidZania ${city} 亲子体验馆` })
        : isRomantic
          ? (isChina ? { en: "Palace Museum Sunset", zh: "故宫日落漫步" } : { en: "Batu Caves Sunset Hike", zh: "黑风洞日落徒步" })
          : (isChina ? { en: "Great Wall Expedition", zh: "长城探险" } : { en: "Petronas Twin Towers & KLCC Park", zh: "双峰塔 & 城市公园" }),
      type: "activity",
      notes: isFamily
        ? { en: "Air-conditioned, 5yo loves it, 2hrs+ of fun", zh: "配套齐全，小孩必玩，轻松游玩2小时以上" }
        : { en: "Iconic landmark, great photography, park picnic", zh: "地标建筑，绝佳拍照打卡点" },
      why: { en: "Top-rated, matches your group vibe perfectly", zh: "评分最高，完美契合你们的出游风格" },
      cost: isFamily ? 120 : isLuxury ? 90 : 0,
      address: isChina ? `${city} Core District` : (isFamily ? "Jalan Stesen Sentral 2, KL Sentral" : "Kuala Lumpur City Centre"),
      transport: "Walk", travelMin: 5, indoor: isFamily,
      mapLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city)}`,
      image: isFamily ? "🎢" : isRomantic ? "🌅" : "🌆",
    },
    {
      id: "food", time: "4:30 PM", endTime: "6:00 PM",
      place: { en: `⭐ ${restaurant.name}`, zh: `⭐ ${restaurant.name}` },
      type: "food",
      notes: { en: `${restaurant.cuisine} cuisine · Rating ${restaurant.rating}⭐ · Recommended: ${restaurant.menu.slice(0,2).join(", ")}`, zh: `${restaurant.cuisine} 料理 · 评分 ${restaurant.rating}⭐ · 推荐菜：${restaurant.menu.slice(0,2).join("、")}` },
      why: { en: "Best match for your dietary preferences, near next stop", zh: "最符合你们的饮食偏好，距下一站很近" },
      cost: isLuxury ? 180 : 85,
      address: isChina ? "Wangfujing, Beijing" : "Jalan Alor, Bukit Bintang",
      transport: "10 min walk", travelMin: 10, indoor: true,
mapLink: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(city)}&travelmode=driving`,
      xhsScore: 9.5, xhsLabel: { en: "Must try the signature dish!", zh: "招牌菜必点！" },
      image: "🍽️",
    },
    {
      id: "citywalk", time: "6:15 PM", endTime: "7:30 PM",
      place: isChina ? { en: "Hutong CityWalk", zh: "胡同 Citywalk + 甜点" } : { en: "Bukit Bintang CityWalk", zh: "武吉免登 Citywalk + 甜点" },
      type: "walk",
      notes: { en: "Great local desserts and vibes", zh: "本地特色甜点小吃 — 气氛一流" },
      why: { en: "Perfect evening cooldown, photo spots, kid-friendly", zh: "完美的傍晚散步消食，拍照打卡" },
      cost: 30, address: isChina ? "Nanluoguxiang, Beijing" : "Bukit Bintang, Kuala Lumpur",
      transport: "Walk", travelMin: 0, indoor: false,
      mapLink: `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent("CityWalk " + city)}`,
      xhsScore: 8.8, xhsLabel: { en: "Golden hour vibes 🌅", zh: "黄金时刻氛围感拉满 🌅" },
      image: "🚶",
    },
    {
      id: "return", time: "7:45 PM", endTime: "8:10 PM",
      place: { en: "Car home — beat the traffic", zh: "专车回家 — 避开高峰" },
      type: "transport",
      notes: { en: "Schedule in advance, beat peak surge pricing", zh: "提前预约专车，避开高峰溢价" },
      why: { en: "Optimal timing before 8pm rush", zh: "8点前出发，完美避开堵车高峰" },
      cost: 22, address: "Home", transport: isChina ? "Didi" : "Grab",
      travelMin: 25, indoor: false,
      mapLink: `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent("home " + city)}`,
      image: "🏠",
    },
  ];

  const totalCost = schedule.reduce((s, x) => s + x.cost, 0);

  return {
    summary: {
      en: `Perfect ${days}-day ${vibes.slice(0,2).map(v=>VIBE_DATA.find(x=>x.id===v)?.label.en||v).join(" + ")} trip in ${city} for ${people} pax`,
      zh: `为 ${people} 人量身定制的 ${days} 天全托管之旅 · ${city}`,
    },
    schedule, totalCost, perPerson: Math.ceil(totalCost / people),
    people, days, currency: cur,
    packing: [
      { category:{en:"👕 Clothing",zh:"👕 服装"}, items: [
        {en:`Tops × ${days + 1} (breathable)`,   zh:`上衣 × ${days+1} 件（透气款）`},
        {en:`Bottoms × ${days} (comfortable)`,   zh:`裤子 × ${days} 件（舒适款）`},
        {en:`Underwear × ${days + 1}`,            zh:`内衣裤 × ${days+1} 件`},
        {en:`Socks × ${days+1}`,                zh:`袜子 × ${days+1} 双`},
        ...(isLuxury
          ? [{en:"Smart casual outfit × 1 (for dining)", zh:"正式服装 × 1 套（高档餐厅用）"}]
          : []),
        {en:"Flat shoes / sneakers (walking-heavy)", zh:"平底鞋/运动鞋（步行多，不建议高跟鞋）"},
        {en:"Light jacket (indoor AC can be cold)",  zh:"薄外套（室内冷气可能很冷）"},
      ]},
      { category:{en:"🧴 Essentials",zh:"🧴 必备品"}, items: [
        {en:"Sunscreen SPF50+ (outdoor stops)",     zh:"防晒霜 SPF50+（有户外站点）"},
        {en:"Power bank 10000mAh+",                 zh:"充电宝 10000mAh 以上"},
        {en:"Cash + credit card",                   zh:"现金 + 信用卡 / 扫码支付"},
        {en:"Umbrella / foldable raincoat",         zh:"折叠雨伞或雨衣"},
        {en:"Reusable water bottle",                zh:"可重复使用水瓶"},
        ...(isFamily ? [
          {en:"Child medicine kit (fever, plasters)", zh:"小孩药品（退烧药、创可贴）"},
          {en:"Wet wipes × 2 packs",                  zh:"湿纸巾 × 2 包"},
        ] : []),
      ]},
      { category:{en:"🔌 Tech & Adapters",zh:"🔌 电器与插头"}, items: [
        {en:`Adapter needed`, zh:`插头：${isChina ? "中国国标两脚/三脚插头" : cur==="MYR"?"G型三脚插头（英国式）":cur==="JPY"?"A型双脚插头（美国式）":cur==="EUR"?"C/F型双圆脚":"通用转接头"}`},
        {en:"Phone charger + cable",                zh:"手机充电器 + 充电线"},
      ]},
    ],
    emergency: isChina ? [
      {label:{en:"🚔 Police",         zh:"🚔 报警"},     number:"110",              icon:"🚔"},
      {label:{en:"🚑 Ambulance",      zh:"🚑 急救"},     number:"120",              icon:"🚑"},
      {label:{en:"🚒 Fire & Rescue",  zh:"🚒 消防救援"}, number:"119",              icon:"🚒"},
      {label:{en:"🏥 Hospital",       zh:"🏥 医院"},     number:"120",              icon:"🏥"},
      {label:{en:"🗺️ Tourist Police", zh:"🗺️ 旅游局"}, number:"12301",            icon:"🗺️"},
      {label:{en:"🛣️ Highway Assist", zh:"🛣️ 大道救援"}, number:"12122",            icon:"🛣️"},
    ] : [
      {label:{en:"🚔 Police",         zh:"🚔 报警"},     number:"999",              icon:"🚔"},
      {label:{en:"🚑 Ambulance",      zh:"🚑 急救"},     number:"999",              icon:"🚑"},
      {label:{en:"🚒 Fire & Rescue",  zh:"🚒 消防救援"}, number:"994",              icon:"🚒"},
      {label:{en:"🏥 Hospital",       zh:"🏥 医院"},     number:"+603-2615 5555",   icon:"🏥"},
      {label:{en:"🗺️ Tourist Police", zh:"🗺️ 旅游警察"}, number:"+603-2149 6590",  icon:"🗺️"},
      {label:{en:"🛣️ Highway Assist", zh:"🛣️ 大道救援"}, number:"1800-88-7752",    icon:"🛣️"},
    ],
    notes: [
      {icon:"🎎",label:{en:"Local Culture",zh:"当地文化"}, value:{en:"Respect local customs.",zh:"尊重当地风俗，拍摄当地人或宗教场所前请先征求同意。"}},
      {icon:"💱",label:{en:"Money Exchange",zh:"货币兑换"}, value:{en:"Use mall changers.",zh:"避免在机场大额换汇（汇率极差），推荐前往大型商场内的官方外币兑换柜台。"}},
      {icon:"🚌",label:{en:"Public Transport",zh:"公共交通"}, value:{en:"Use ride hailing apps.",zh:"遇到下班晚高峰或大雨时，轻轨可能极度拥挤，强烈建议直接呼叫网约车。"}},
      {icon:"🌶️",label:{en:"Food Culture",zh:"饮食文化"}, value:{en:"Dietary notes.",zh:"已为您规避食物过敏源。大多数热门餐厅可通过美团/Grab进行提前预订排号。"}},
      {icon:"🔒",label:{en:"Safety Index",zh:"治安指数"}, value:{en:"Very Safe.",zh:"核心商圈治安极好，夜间请保持在灯光明亮的主街道步行即可。"}},
    ],
    summaryMessage: {
      en: `✅ PlanGo sorted it! ${days}-day trip in ${city} for ${people} pax. Est. ${fmt(totalCost, cur)} total (${fmt(Math.ceil(totalCost/people), cur)}/person). Departs 2PM sharp. Book now?`,
      zh: `✅ PlanGo 搞定了！${city} ${days}天全托管行程，${people}人出发。预计总花费 ${fmt(totalCost, cur)}（人均 ${fmt(Math.ceil(totalCost/people), cur)}）。下午2点准时出发，马上预订？`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [lang, setLang]     = useState<Lang>("zh");
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName]     = useState("Xiao Ming");
  const [page, setPage]     = useState<PageId>("planner");
  
  // DEFAULT TO CHINA / CNY
  const [currency, setCurrency] = useState<Currency>("CNY");
  const [selectedContinent, setSelectedContinent] = useState("Asia 🌏");
  const [selectedCountry,   setSelectedCountry]   = useState("China 🇨🇳");
  const [selectedCity,      setSelectedCity]       = useState("Beijing");
  
  // Planner state
  const [plannerState, setPlannerState] = useState<"chat" | "config">("chat");
  const [people,  setPeople]  = useState(4);
  const [days,    setDays]    = useState(1);
  const [budget,  setBudget]  = useState(1500);
  const [budgetTier, setBudgetTier] = useState("comfort");
  const [vibes,   setVibes]   = useState<string[]>([]);
  const [chatInput,   setChatInput]   = useState(""); 
  const [messages,    setMessages]    = useState<{role:string;content:string}[]>([]);

  // QnA
  const [qnaDone, setQnaDone] = useState(false);
  const [foodPref, setFoodPref] = useState<string[]>([]);
  const [halalCount,setHalalCount]=useState(0);
  const [vegCount,  setVegCount]  =useState(0);
  const [meatCount, setMeatCount] =useState(0);
  const [transport, setTransport] = useState<string[]>(["grab"]);
  const [departTime, setDepartTime] = useState("2:00 PM");
  const [returnTime, setReturnTime] = useState("8:00 PM");
  const [concerns, setConcerns] = useState("");

  // Plan
  const [plan, setPlan] = useState<Plan|null>(null);
  const [activeTab, setActiveTab] = useState<"schedule"|"budget"|"replan"|"group">("schedule");
  const [timeOffset, setTimeOffset] = useState(0);
  const [actualCosts, setActualCosts] = useState<Record<string,number>>({});
  const [doneActions, setDoneActions] = useState<Record<string,boolean>>({});
  const [packingDone, setPackingDone] = useState<Record<string,boolean>>({});
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanLog, setReplanLog] = useState<string[]>([]);
  const [customReplan, setCustomReplan] = useState("");
  const [openStop, setOpenStop] = useState<string|null>(null);
  const [xhsRatings, setXhsRatings] = useState<Record<string,"up"|"down"|null>>({});
  const [bookedSeats, setBookedSeats] = useState<Record<string,string>>({});
  const [votes, setVotes] = useState<Record<string,"yes"|"no"|null>>({});
  const [memories, setMemories] = useState<Record<string,boolean>>({healthy:true,avoidCrowds:true,family:true});

  const chatRef = useRef<HTMLDivElement>(null);
  const l = (v:Bilingual) => v[lang];

  useEffect(()=>{ chatRef.current?.scrollTo({top:9999,behavior:"smooth"}); },[messages]);

  // Sync plan currency when header changes
  useEffect(()=>{ if(plan) setPlan(p=>p?{...p,currency}:null); },[currency]);

  function handleChat() {
    if(!chatInput.trim()) return;
    setMessages(p=>[...p,{role:"user",content:chatInput}]);
    
    // Switch to config view instantly to show loading/chat box at top
    setPlannerState("config");

    setTimeout(()=>{
      // Smart intelligence to map natural language to cities
      let city = selectedCity;
      const lowerInput = chatInput.toLowerCase();
      
      if (lowerInput.match(/kl|kuala lumpur|吉隆坡/i)) city = "Kuala Lumpur";
      else if (lowerInput.match(/penang|槟城/i)) city = "Penang";
      else if (lowerInput.match(/tokyo|东京/i)) city = "Tokyo";
      else if (lowerInput.match(/beijing|北京/i)) city = "Beijing";
      else if (lowerInput.match(/shanghai|上海/i)) city = "Shanghai";
      else if (lowerInput.match(/guangzhou|广州/i)) city = "Guangzhou";
      else city = selectedCity || "Beijing";

      if(city !== selectedCity) {
          setSelectedCity(city);
          const foundCountry = WORLD.find(w => w.countries.some(c => c.cities.includes(city)));
          if (foundCountry) {
              setSelectedContinent(foundCountry.continent);
              const cName = foundCountry.countries.find(c => c.cities.includes(city))?.name;
              if (cName) setSelectedCountry(cName);
              const targetCur = foundCountry.countries.find(c => c.cities.includes(city))?.currency;
              if (targetCur) setCurrency(targetCur);
          }
      }
      
      // Auto-extract some basic parameters to make it feel smart
      if(chatInput.includes("5岁") || chatInput.includes("孩子") || chatInput.includes("亲子")) {
        if(!vibes.includes("family")) setVibes(v => [...v, "family"]);
      }
      if(chatInput.includes("减肥") || chatInput.includes("素食")) {
        if(!foodPref.includes("veg")) setFoodPref(p => [...p, "veg"]);
      }

      setMessages(p=>[...p,{role:"assistant",content:l({
        en:`Got it! I've extracted your preferences for ${city}. Please verify the settings below before we proceed. 📍`,
        zh:`收到！我已从您的描述中提取了去 ${city} 的需求，请在下方核对生成的参数大盘 📍`,
      })}]);
    },800);
  }

  function generatePlan() {
    const city = selectedCity || "Beijing";
    const cur = currency;
    const p = buildMockPlan(city, people, days, cur, vibes, budgetTier);
    setPlan(p);
    setCurrency(cur);
    // Initialize actual costs safely
    setActualCosts(Object.fromEntries(p.schedule.map(s=>[s.id, Math.round(s.cost * CURRENCIES[cur].rate)])));
    setVotes(Object.fromEntries(p.schedule.map(s=>[s.id,null])));
    setPage("main");
    setActiveTab("schedule");
  }

  function applyReplan(type:string) {
    if(!plan) return;
    setIsReplanning(true);
    try {
      const ac=new AudioContext(); const o=ac.createOscillator(); const g=ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.setValueAtTime(880,ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(330,ac.currentTime+0.3);
      g.gain.setValueAtTime(0.1,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
      o.start(); o.stop(ac.currentTime+0.4);
    } catch{}
    setTimeout(()=>{
      const msg = type==="rain"
        ? (lang==="en"?"🌧️ Rain: outdoor replaced with indoor alternatives.":"🌧️ 下雨：户外站点已换成室内替代方案。")
        : type==="full"
          ? (lang==="en"?"🚫 Restaurant full: backup reserved nearby.":"🚫 餐厅满座：已预订附近后备餐厅。")
          : type==="traffic"
            ? (lang==="en"?"🚗 Traffic jam: all times pushed +20min.":"🚗 堵车：所有时间顺延20分钟。")
            : type==="budget"
              ? (lang==="en"?"💸 Budget optimized: cheaper alternatives applied.":"💸 预算已优化：换成更实惠的替代选择。")
              : type==="tired"
                ? (lang==="en"?"😴 Route shortened: head back earlier.":"😴 已缩短行程，提早回家。")
                : (lang==="en"?`✅ Custom replan applied: "${type}".`:`✅ 已根据「${type}」重新规划行程。`);
      setReplanLog(p=>[msg,...p]);
      setIsReplanning(false);
      setActiveTab("schedule");
    },1600);
  }

  // ─── LOGIN ──────────────────────────────────────────────────────
  if(!loggedIn) return (
    <div className="min-h-screen bg-[#050f1a] text-white flex items-center justify-center p-6">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-0 rounded-3xl overflow-hidden shadow-2xl border border-blue-900/30">
        <div className="bg-gradient-to-br from-[#0a1f35] to-[#050f1a] p-12 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center font-black text-xl text-gray-900">P</div>
            <div className="text-2xl font-black">Plan<span className="text-yellow-400">Go</span> <span className="text-gray-400 text-lg font-bold">旅享家</span></div>
          </div>
          <h1 className="text-4xl font-black leading-tight">{l({en:"Plan it.\nApprove it.\nExecute it.",zh:"规划。\n确认。\n执行。"})}</h1>
          <p className="text-gray-400">{l({en:"AI lifestyle concierge — from one sentence to a fully-booked trip.",zh:"AI 出游助手 — 一句话生成完整可执行行程。"})}</p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {AGENT_CARDS.map(a=>(
              <div key={a.en} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-lg mb-1">{a.icon}</div>
                <div className="text-xs font-bold text-white">{lang==="en"?a.en:a.zh}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#0b1f35] p-12 flex flex-col gap-5">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-black">{l({en:"Sign in",zh:"先登录"})}</h2>
            <button onClick={()=>setLang(l=>l==="en"?"zh":"en")} className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold">{lang==="en"?"中文":"EN"}</button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-bold uppercase">{l({en:"Name",zh:"名字"})}</span>
            <input value={name} onChange={e=>setName(e.target.value)} className="bg-[#050f1a] border border-blue-900/50 rounded-xl p-3 text-white outline-none focus:border-yellow-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-bold uppercase">{l({en:"Email",zh:"电邮"})}</span>
            <input defaultValue="xiaoming@example.com" className="bg-[#050f1a] border border-blue-900/50 rounded-xl p-3 text-white outline-none focus:border-yellow-400" />
          </label>
          <button onClick={()=>setLoggedIn(true)} className="mt-2 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-yellow-400 text-gray-900 font-black text-lg hover:opacity-90 transition shadow-lg shadow-blue-500/20">
            {l({en:"Enter PlanGo →",zh:"进入 PlanGo →"})}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── MAIN APP ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#050f1a] text-white overflow-hidden">

      {/* ── COLLAPSIBLE SIDEBAR ─────────────────────────────────── */}
      <aside className="group relative h-full bg-[#07172a] border-r border-blue-900/30 w-16 hover:w-60 transition-all duration-300 z-50 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-blue-900/30 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center font-black text-gray-900 shrink-0">P</div>
          <span className="ml-3 font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Plan<span className="text-yellow-400">Go</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-1 overflow-hidden">
          {NAV_ITEMS.map(item=>{
            const isActive = page===item.id || (page==="main" && item.id==="main");
            return (
              <button key={item.id}
                onMouseEnter={()=>{ if(item.id!=="main"||plan) setPage(item.id as PageId); }}
                onClick={()=>{ if(item.id!=="main"||plan) setPage(item.id as PageId); }}
                title={l(item.label)}
                className={`flex items-center h-11 px-4 transition-all ${isActive?"bg-blue-600/20 text-blue-300 border-r-2 border-blue-400":"text-gray-400 hover:text-white hover:bg-white/5"} ${(!plan&&item.id==="main")?"opacity-30 cursor-not-allowed":""}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="ml-3 text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-1 text-left">{l(item.label)}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-blue-900/30 p-3 flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-yellow-400 flex items-center justify-center text-gray-900 font-black text-sm shrink-0">
            {name[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{name}</span>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 border-b border-blue-900/30 flex items-center justify-end px-6 gap-3 bg-[#07172a] shrink-0">
  {/* 货币选择器 */}
  <select value={currency} onChange={e=>setCurrency(e.target.value as Currency)}
    className="bg-[#050f1a] border border-blue-900/50 rounded-full px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-yellow-400 cursor-pointer">
    {(Object.keys(CURRENCIES) as Currency[]).map(c=>(
      <option key={c} value={c}>{c}</option>
    ))}
  </select>

  <button onClick={()=>setLang(l=>l==="en"?"zh":"en")} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold">
    {lang==="en"?"中文":"EN"}
  </button>

  {/* 只有生成行程后才显示这两个顶部执行按钮 */}
  {plan && (
    <>
      <button onClick={()=>{setPage("main");setActiveTab("replan");}} className="px-4 py-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-xs font-bold flex items-center gap-1.5">
        <RefreshCcw className="w-3.5 h-3.5"/> {l({en:"Replan",zh:"改行程"})}
      </button>
      <button onClick={()=>{setPage("main");setActiveTab("schedule");setOpenStop("food");}} className="px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-yellow-400 text-gray-900 text-xs font-black flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5"/> {l({en:"Execute",zh:"一键执行"})}
      </button>
    </>
  )}
</header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ PAGE: PLANNER (Gemini UI / Config) ══════════════════════════════════════ */}
          {page==="planner" && plannerState === "chat" && (
            <div className="flex flex-col items-center justify-center min-h-[75vh] max-w-3xl mx-auto w-full px-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-8">
                <BrainCircuit className="w-10 h-10 text-gray-900" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-wide text-center">
                {l({en: `Hello, ${name}`, zh: `你好，${name}`})}
              </h1>
              <p className="text-lg text-gray-400 mb-12 text-center max-w-xl">
                {l({en: "Tell me what kind of trip you want today, and I'll handle the rest.", zh: "一句话告诉我今天想怎么玩，剩下的交给我。不是搜推，是帮你把事情做完。"})}
              </p>

              {/* Big Input Box (Gemini Style) */}
              <div className="w-full relative shadow-2xl shadow-blue-900/20 rounded-2xl group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-yellow-400 rounded-2xl opacity-40 group-hover:opacity-70 transition duration-500 blur"></div>
                <div className="relative flex items-center bg-[#050f1a] border border-blue-900/50 rounded-2xl p-2 pr-3">
                   <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleChat()}
                      placeholder={l({en:"e.g. Plan a 2-day trip to Penang for 4 friends",zh:"例如：带老婆孩子去北京玩几天，别太远..."})}
                      className="flex-1 bg-transparent p-4 md:p-5 outline-none text-base placeholder-gray-500 text-white" />
                    <button onClick={handleChat} className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center hover:scale-105 transition-transform shrink-0 shadow-md">
                      <Send className="w-5 h-5 text-white"/>
                    </button>
                </div>
              </div>

              {/* Suggested prompts */}
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                 <button onClick={()=>setChatInput("带5岁小孩去北京室内玩，不想走路")} className="px-4 py-2 rounded-full border border-blue-900/50 text-xs font-bold text-gray-400 hover:text-yellow-400 hover:border-yellow-400/50 transition bg-[#0b1f35]/50">🎈 带5岁小孩去北京室内玩，不想走路</button>
                 <button onClick={()=>setChatInput("情侣约会，找个高分晚餐看风景")} className="px-4 py-2 rounded-full border border-blue-900/50 text-xs font-bold text-gray-400 hover:text-yellow-400 hover:border-yellow-400/50 transition bg-[#0b1f35]/50">🍷 情侣约会，找个高分晚餐看风景</button>
                 <button onClick={()=>setChatInput("和3个朋友去逛街吃小吃")} className="px-4 py-2 rounded-full border border-blue-900/50 text-xs font-bold text-gray-400 hover:text-yellow-400 hover:border-yellow-400/50 transition bg-[#0b1f35]/50">🛍️ 和3个朋友去逛街吃小吃</button>
              </div>
            </div>
          )}

          {page==="planner" && plannerState === "config" && (
            <div className="max-w-5xl mx-auto p-6 pb-24 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              <button onClick={() => setPlannerState("chat")} className="text-blue-400 text-sm font-bold flex items-center gap-2 mb-4 hover:text-blue-300 w-fit">
                 <Undo2 className="w-4 h-4"/> {l({en: "Back to Chat", zh: "返回对话"})}
              </button>

              {/* Chat history display */}
              <div className="bg-[#0b1f35] rounded-3xl border border-blue-900/30 overflow-hidden shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center"><BrainCircuit className="w-5 h-5 text-gray-900"/></div>
                    <div>
                      <div className="font-black text-lg">PlanGo AI</div>
                      <div className="text-xs text-gray-400">{l({en:"Extracted preferences",zh:"为您提取的需求参数"})}</div>
                    </div>
                  </div>
                  <div className="space-y-3 min-h-[80px]" ref={chatRef}>
                    {messages.map((m,i)=>(
                      <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[80%] ${m.role==="user"?"bg-blue-600 text-white":"bg-white/10 text-blue-100"}`}>{m.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── LOCATION SELECTOR ── */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h2 className="font-black text-lg mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400"/> {l({en:"Where to?",zh:"去哪里？"})}</h2>
                {/* Continents */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {WORLD.map(w=>(
                    <button key={w.continent} onClick={()=>{setSelectedContinent(w.continent);setSelectedCountry("");setSelectedCity("");}}
                      className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${selectedContinent===w.continent?"bg-blue-600 border-blue-500 text-white":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-blue-500/50"}`}>
                      {w.continent}
                    </button>
                  ))}
                </div>
                {/* Countries */}
                {selectedContinent && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {WORLD.find(w=>w.continent===selectedContinent)?.countries.map(c=>(
                      <button key={c.name} onClick={()=>{setSelectedCountry(c.name);setSelectedCity("");setCurrency(c.currency);}}
                        className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${selectedCountry===c.name?"bg-yellow-400/20 border-yellow-400 text-yellow-300":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-yellow-400/50"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Cities with images */}
                {selectedCountry && (
                  <div className="flex flex-wrap gap-3">
                    {WORLD.flatMap(w=>w.countries).find(c=>c.name===selectedCountry)?.cities.map(city=>(
                      <button key={city} onClick={()=>setSelectedCity(city)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition ${selectedCity===city?"bg-gradient-to-r from-blue-600/30 to-yellow-400/10 border-yellow-400 text-yellow-300":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-blue-400/50"}`}>
                        <span className="text-xl">{CITY_IMAGES[city]||"🏙️"}</span>{city}
                      </button>
                    ))}
                  </div>
                )}
                {selectedCity && (
                  <div className="mt-4 flex items-center gap-3 bg-green-900/20 border border-green-500/30 rounded-xl px-4 py-3">
                    <span className="text-2xl">{CITY_IMAGES[selectedCity]||"🏙️"}</span>
                    <div><div className="font-bold text-green-300">{selectedCity}</div><div className="text-xs text-green-500">{l({en:"Destination confirmed",zh:"目的地已确认"})}</div></div>
                  </div>
                )}
              </div>

              {/* ── PEOPLE / DAYS / BUDGET ── */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label:{en:"👥 People",zh:"👥 人数"}, value:people, set:setPeople, min:1, max:20, isBudget:false },
                  { label:{en:"📅 Days",  zh:"📅 天数"}, value:days,   set:setDays,   min:1, max:30, isBudget:false },
                  { label:{en:"💰 Budget",zh:"💰 预算"}, value:Math.round(budget * CURRENCIES[currency].rate), set:(val:number) => setBudget(val / CURRENCIES[currency].rate), min:Math.round(50 * CURRENCIES[currency].rate), max:500000, step:Math.round(50 * CURRENCIES[currency].rate), isBudget:true },
                ].map(item=>(
                  <div key={item.label.en} className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-3">{l(item.label)}</div>
                    <div className="flex items-center gap-3">
                      <button onClick={()=>item.set(Math.max(item.min, item.value - (item.step||1)))}
                        className="w-9 h-9 rounded-full bg-[#050f1a] border border-blue-900/50 flex items-center justify-center hover:bg-blue-600/20 transition">
                        <Minus className="w-4 h-4"/>
                      </button>
                      <div className="flex-1 text-center">
                        {item.isBudget ? (
                          <input type="number" value={item.value}
                            onChange={e=>item.set(Math.max(item.min,Number(e.target.value)))}
                            className="w-full bg-transparent text-center text-2xl font-black text-yellow-400 outline-none" />
                        ) : (
                          <span className="text-2xl font-black text-yellow-400">{item.value}</span>
                        )}
                        {item.isBudget && <div className="text-xs text-gray-500">{CURRENCIES[currency].symbol} {CURRENCIES[currency].name}</div>}
                      </div>
                      <button onClick={()=>item.set(Math.min(item.max, item.value + (item.step||1)))}
                        className="w-9 h-9 rounded-full bg-[#050f1a] border border-blue-900/50 flex items-center justify-center hover:bg-blue-600/20 transition">
                        <Plus className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── BUDGET TIER ── */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h2 className="font-black text-lg mb-4">💎 {l({en:"Budget style",zh:"消费风格"})}</h2>
                <div className="grid grid-cols-3 gap-4">
                  {BUDGET_TIERS.map(t=>(
                    <button key={t.id} onClick={()=>setBudgetTier(t.id)}
                      className={`p-5 rounded-2xl border text-center transition ${budgetTier===t.id?"bg-yellow-400/10 border-yellow-400 text-yellow-300":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-yellow-400/40"}`}>
                      <div className="text-3xl mb-2">{t.img}</div>
                      <div className="font-black">{l(t.label)}</div>
                      <div className="text-xs mt-1 opacity-70">
                        {t.id === "backpacker" && `<${fmt(t.max, currency)}/${lang==='en'?'day':'天'}`}
                        {t.id === "comfort" && `${fmt(t.min, currency)}-${fmt(t.max, currency)}/${lang==='en'?'day':'天'}`}
                        {t.id === "luxury" && `>${fmt(t.min, currency)}/${lang==='en'?'day':'天'}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── VIBE SELECTOR ── */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h2 className="font-black text-lg mb-2">{l({en:"Travel vibe (multi-select)",zh:"出游氛围（可多选）"})}</h2>
                <p className="text-xs text-gray-400 mb-4">{l({en:"Select all that apply",zh:"可以选多个"})}</p>
                <div className="grid grid-cols-5 gap-3">
                  {VIBE_DATA.map(v=>{
                    const sel = vibes.includes(v.id);
                    return (
                      <button key={v.id} onClick={()=>setVibes(p=>p.includes(v.id)?p.filter(x=>x!==v.id):[...p,v.id])}
                        className={`p-4 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${sel?"border-2 text-white":"bg-[#050f1a] border-blue-900/30 text-gray-400 hover:border-blue-400/40"}`}
                        style={sel?{borderColor:v.color,background:`${v.color}18`}:{}}>
                        <span className="text-2xl">{v.img}</span>
                        <span className="text-xs font-bold">{l(v.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate button */}
<button onClick={() => setPage("qna")} 
  className="w-full py-5 rounded-2xl bg-gradient-to-r from-blue-500 to-yellow-400 text-gray-900 font-black text-xl hover:opacity-90 transition shadow-2xl flex items-center justify-center gap-3">
  <Zap className="w-6 h-6"/> {l({en:"Continue to Smart Q&A →",zh:"继续智能追问 →"})}
</button>
            </div>
          )}

          {/* ══ PAGE: QnA ══════════════════════════════════════════ */}
          {page==="qna" && (
            <div className="max-w-2xl mx-auto p-6 pb-24 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6">
                <h1 className="text-3xl font-black">{l({en:"A few quick questions",zh:"最后几个小问题"})}</h1>
                <p className="text-gray-400 mt-1">{l({en:"Tap to select. No typing required (except the last one).",zh:"点击选择，无需打字（最后一题除外）。"})}</p>
              </div>

              {/* Time preference */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-400"/> {l({en:"Trip duration",zh:"出游时长"})}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block mb-2">{l({en:"Departure time",zh:"出发时间"})}</label>
                    <div className="flex gap-2">
                      {["10:00 AM","12:00 PM","2:00 PM","4:00 PM"].map(t=>(
                        <button key={t} onClick={()=>setDepartTime(t)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold ${departTime===t?"bg-blue-600 border-blue-500 text-white":"bg-[#050f1a] border-blue-900/30 text-gray-400 hover:border-blue-400"}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block mb-2">{l({en:"Return time",zh:"回程时间"})}</label>
                    <div className="flex gap-2">
                      {["6:00 PM","8:00 PM","10:00 PM","Late"].map(t=>(
                        <button key={t} onClick={()=>setReturnTime(t)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold ${returnTime===t?"bg-blue-600 border-blue-500 text-white":"bg-[#050f1a] border-blue-900/30 text-gray-400 hover:border-blue-400"}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Food preferences */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Utensils className="w-5 h-5 text-yellow-400"/> {l({en:"Food preferences",zh:"饮食偏好"})}</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    {id:"meat",   icon:"🍖", label:{en:"Non-veg",   zh:"荤食"}},
                    {id:"veg",    icon:"🥗", label:{en:"Vegetarian",zh:"素食"}},
                    {id:"halal",  icon:"☪️", label:{en:"Halal",    zh:"清真 Halal"}},
                    {id:"seafood",icon:"🦞", label:{en:"Seafood",   zh:"海鲜"}},
                    {id:"durian", icon:"🌵", label:{en:"Durian 🌵", zh:"榴莲 🌵"}},
                    {id:"none",   icon:"✨", label:{en:"No restriction",zh:"无限制"}},
                  ].map(f=>(
                    <button key={f.id} onClick={()=>setFoodPref(p=>p.includes(f.id)?p.filter(x=>x!==f.id):[...p,f.id])}
                      className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-1.5 transition ${foodPref.includes(f.id)?"bg-yellow-400/10 border-yellow-400 text-yellow-300":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-yellow-400/40"}`}>
                      {f.icon} {l(f.label)}
                    </button>
                  ))}
                </div>
                {/* Mixed count */}
                {(foodPref.includes("halal")||foodPref.includes("veg")||foodPref.includes("meat")) && (
                  <div className="bg-[#050f1a] rounded-xl p-4 border border-blue-900/30">
                    <p className="text-xs text-gray-400 mb-3">{l({en:"How many pax per preference?",zh:"每种饮食各有几人？"})}</p>
                    <div className="flex flex-wrap gap-4">
                      {foodPref.includes("meat")  && <Counter label={l({en:"🍖 Meat", zh:"🍖 荤食"})} value={meatCount}  onChange={setMeatCount} />}
                      {foodPref.includes("veg")   && <Counter label={l({en:"🥗 Veg",  zh:"🥗 素食"})} value={vegCount}   onChange={setVegCount} />}
                      {foodPref.includes("halal") && <Counter label={l({en:"☪️ Halal",zh:"☪️ 清真"})} value={halalCount} onChange={setHalalCount} />}
                    </div>
                  </div>
                )}
              </div>

              {/* Transport */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-green-400"/> {l({en:"Transport",zh:"交通方式"})}</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    {id:"grab",    icon:"🚗", label:{en:"Grab / Taxi",   zh:"叫车 (Grab/滴滴)"}},
                    {id:"public",  icon:"🚌", label:{en:"Public transit", zh:"公共交通"}},
                    {id:"car",     icon:"🚙", label:{en:"Own car",        zh:"自驾"}},
                    {id:"walk",    icon:"🚶", label:{en:"Walking only",   zh:"步行"}},
                  ].map(t=>(
                    <button key={t.id} onClick={()=>setTransport(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])}
                      className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-1.5 transition ${transport.includes(t.id)?"bg-green-500/10 border-green-500 text-green-300":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-green-400/40"}`}>
                      {t.icon} {l(t.label)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Concerns */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-6">
                <h3 className="font-bold mb-3">{l({en:"💬 Anything else?",zh:"💬 还有什么顾虑？"})}</h3>
                <textarea value={concerns} onChange={e=>setConcerns(e.target.value)}
                  placeholder={l({en:"e.g. need wheelchair access, want to avoid crowds, surprise birthday…",zh:"例如：需要婴儿车通道、不要太多人、想去北京看升旗…"})}
                  className="w-full bg-[#050f1a] border border-blue-900/30 rounded-xl p-3 text-sm text-white outline-none focus:border-yellow-400 resize-none h-24" />
              </div>

              <button onClick={generatePlan}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-blue-500 to-yellow-400 text-gray-900 font-black text-xl hover:opacity-90 transition shadow-xl flex items-center justify-center gap-3">
                <Zap className="w-6 h-6"/> {l({en:"Generate Ultimate Plan ✨",zh:"一键生成完美行程 ✨"})}
              </button>

            </div>
          )}

          {/* ══ PAGE: MAIN (tabs: Schedule / Budget / Replan / Group) ══ */}
          {page==="main" && plan && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-blue-900/30 bg-[#07172a] shrink-0">
                {(["schedule","budget","replan","group"] as const).map(tab=>(
                  <button key={tab} onClick={()=>setActiveTab(tab)}
                    className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab===tab?"text-yellow-400 border-b-2 border-yellow-400":"text-gray-400 hover:text-white"}`}>
                    {TAB_ICONS[tab]} {l(TAB_LABELS[tab])}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 pb-20 max-w-4xl mx-auto w-full">
                
                {/* ── SCHEDULE TAB ─── */}
                {activeTab==="schedule" && (
                  <div className="space-y-4">
                    {/* Header card */}
                    <div className="bg-gradient-to-br from-[#0b1f35] to-[#071427] rounded-3xl p-6 border border-blue-900/30">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-xs text-blue-300 font-bold uppercase mb-1">{selectedCity || "Your Trip"} {CITY_IMAGES[selectedCity]||"🏙️"}</div>
                          <h2 className="text-2xl font-black text-white">{l(plan.summary)}</h2>
                        </div>
                        {/* Start time adjuster */}
                        <div className="text-right">
                          <div className="text-xs text-gray-400 mb-1">{l({en:"Start time",zh:"出发时间"})}</div>
                          <div className="flex items-center gap-2 bg-[#050f1a] rounded-xl p-1.5 border border-blue-900/30">
                            <button onClick={()=>setTimeOffset(t=>t-15)} className="p-1 hover:bg-white/10 rounded-lg"><Minus className="w-3.5 h-3.5"/></button>
                            <span className="text-sm font-black text-yellow-400 w-16 text-center">
                              {shiftTimeStr(departTime, timeOffset)}
                            </span>
                            <button onClick={()=>setTimeOffset(t=>t+15)} className="p-1 hover:bg-white/10 rounded-lg"><Plus className="w-3.5 h-3.5"/></button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-yellow-400"/><span className="font-bold">{plan.schedule.length} {l({en:"stops",zh:"个站点"})}</span></div>
                        <div className="flex items-center gap-2 text-sm"><Wallet className="w-4 h-4 text-yellow-400"/><span className="font-bold">{fmt(plan.totalCost,currency)}</span></div>
                        <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-yellow-400"/><span className="font-bold">{plan.people} {l({en:"pax",zh:"人"})}</span></div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="relative pl-8 border-l-2 border-dashed border-blue-800/50 ml-4 space-y-0">
                      {plan.schedule.map((stop,idx)=>{
                        const adjTime = shiftTimeStr(stop.time, timeOffset);
                        const isOpen = openStop===stop.id;
                        return (
                          <div key={stop.id} className="relative pb-8">
                            {/* Step dot */}
                            <div className="absolute -left-[41px] top-4 w-9 h-9 rounded-full bg-blue-600 text-white font-black flex items-center justify-center border-4 border-[#050f1a] shadow-lg shadow-blue-500/30 text-sm z-10">
                              {idx+1}
                            </div>

                            <div className={`bg-[#0b1f35] rounded-2xl border transition-all ${isOpen?"border-yellow-400/50 shadow-lg shadow-yellow-400/5":"border-blue-900/30 hover:border-blue-500/40"}`}>
                              {/* Stop header — always visible */}
                              <button className="w-full p-5 text-left" onClick={()=>setOpenStop(isOpen?null:stop.id)}>
                                <div className="flex justify-between items-start">
                                  <div className="flex gap-3 items-start">
                                    <span className="text-2xl mt-0.5">{stop.image||"📍"}</span>
                                    <div>
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-yellow-400 font-black text-sm">{adjTime}</span>
                                        <span className="text-gray-500 text-xs">→ {shiftTimeStr(stop.endTime,timeOffset)}</span>
                                        {stop.adSponsored && <span className="px-1.5 py-0.5 bg-yellow-400/20 border border-yellow-400/40 rounded text-yellow-400 text-xs font-bold">AD</span>}
                                      </div>
                                      <h3 className="font-black text-white text-base">{l(stop.place)}</h3>
                                      <p className="text-gray-400 text-sm mt-0.5 line-clamp-1">{l(stop.notes)}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-yellow-400 font-black">{fmt(stop.cost,currency)}</span>
                                    {stop.rating && <div className="flex items-center gap-1 text-xs"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400"/><span className="font-bold">{stop.rating}</span></div>}
                                    {isOpen?<ChevronUp className="w-4 h-4 text-gray-400"/>:<ChevronDown className="w-4 h-4 text-gray-400"/>}
                                  </div>
                                </div>
                              </button>

                              {/* Expanded details */}
                              {isOpen && (
                                <div className="px-5 pb-5 space-y-4 border-t border-blue-900/20 pt-4">
                                  {/* AI reason */}
                                  <div className="flex gap-2 bg-purple-900/20 rounded-xl p-3 border border-purple-900/30">
                                    <BrainCircuit className="w-4 h-4 text-purple-400 mt-0.5 shrink-0"/>
                                    <p className="text-sm text-purple-200"><span className="font-bold text-purple-300">AI: </span>{l(stop.why)}</p>
                                  </div>
                                  
                                  {/* Tags */}
                                  <div className="flex flex-wrap gap-2">
                                    <span className="px-2.5 py-1 bg-[#050f1a] border border-blue-900/30 rounded-lg text-xs font-bold text-blue-300">{stop.type}</span>
                                    <span className="px-2.5 py-1 bg-[#050f1a] border border-blue-900/30 rounded-lg text-xs font-bold text-gray-300">{stop.indoor?"🏠 indoor":"🌤️ outdoor"}</span>
                                    {stop.travelMin>0 && <span className="px-2.5 py-1 bg-[#050f1a] border border-blue-900/30 rounded-lg text-xs font-bold text-gray-300">🚶 {stop.travelMin}min travel</span>}
                                    {(stop.queueTime ?? 0) > 0 && (
                                      <span className="px-2.5 py-1 bg-orange-900/20 border border-orange-500/30 rounded-lg text-xs font-bold text-orange-300">⏳ ~{stop.queueTime}min queue</span>
                                    )}
                                  </div>

                                  {/* Google Maps button */}
                                  <a href={stop.mapLink} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#050f1a] border border-blue-900/30 rounded-xl text-sm font-bold text-blue-300 hover:border-blue-400 transition w-fit">
                                    <ExternalLink className="w-4 h-4"/>{l({en:"Open in Google Maps",zh:"在 Google Maps 中查看"})}
                                  </a>

                                  {/* Restaurant: menu + seats + booking */}
                                  {stop.type==="food" && stop.menu && (
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-xs text-gray-400 font-bold uppercase mb-2">{l({en:"Recommended menu",zh:"推荐菜单"})}</div>
                                        <div className="flex flex-wrap gap-2">
                                          {stop.menu?.map(item=>(
                                            <span key={item} className="px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-xl text-xs font-bold text-yellow-300 flex items-center gap-1">
                                              <Flame className="w-3 h-3"/>{item}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      {stop.phone && (
                                        <a href={`tel:${stop.phone}`} className="flex items-center gap-2 text-sm text-green-300 font-bold hover:underline">
                                          <Phone className="w-4 h-4"/>{stop.phone}
                                        </a>
                                      )}
                                      {stop.seats && (
                                        <div>
                                          <div className="text-xs text-gray-400 font-bold uppercase mb-2">{l({en:"Available seats by time",zh:"各时段空位"})}</div>
                                          <div className="flex flex-wrap gap-2">
                                            {stop.seats?.map(slot=>(
                                              <button key={slot.time}
                                                onClick={()=>setBookedSeats(p=>({...p,[stop.id]:slot.time}))}
                                                className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-0.5 ${bookedSeats[stop.id]===slot.time?"bg-green-600 border-green-500 text-white":"bg-[#050f1a] border-blue-900/30 text-gray-300 hover:border-green-400"} ${slot.available<=2?"border-orange-500/50":""}`}>
                                                <span>{slot.time}</span>
                                                <span className={`text-xs ${slot.available<=2?"text-orange-400":"text-green-400"}`}>
                                                  {slot.available} {l({en:"seats",zh:"个空位"})}
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                          {bookedSeats[stop.id] && (
                                            <div className="mt-2 flex items-center gap-2 text-green-400 text-sm font-bold">
                                              <CheckCircle2 className="w-4 h-4"/>
                                              {l({en:`Booked for ${bookedSeats[stop.id]} ✓`,zh:`已预订 ${bookedSeats[stop.id]} ✓`})}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* XHS-style rating */}
                                  {stop.xhsScore && (
                                    <div className="bg-red-900/20 border border-red-900/30 rounded-xl p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-red-300">📕 小红书评分</span>
                                        <span className="text-lg font-black text-red-300">{stop.xhsScore}/10</span>
                                      </div>
                                      <p className="text-sm text-gray-300 italic">"{stop.xhsLabel?l(stop.xhsLabel):""}"</p>
                                      <div className="flex gap-2 mt-3">
                                        <button onClick={()=>setXhsRatings(p=>({...p,[stop.id]:"up"}))}
                                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition ${xhsRatings[stop.id]==="up"?"bg-green-600 border-green-500 text-white":"bg-[#050f1a] border-gray-700 text-gray-400 hover:border-green-400"}`}>
                                          <ThumbsUp className="w-3.5 h-3.5"/> {l({en:"Recommend",zh:"推荐"})}
                                        </button>
                                        <button onClick={()=>setXhsRatings(p=>({...p,[stop.id]:"down"}))}
                                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition ${xhsRatings[stop.id]==="down"?"bg-red-600 border-red-500 text-white":"bg-[#050f1a] border-gray-700 text-gray-400 hover:border-red-400"}`}>
                                          <ThumbsDown className="w-3.5 h-3.5"/> {l({en:"Not for me",zh:"不推荐"})}
                                        </button>
                                        <button onClick={()=>setXhsRatings(p=>({...p,[stop.id]:"up"}))}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-900/30 bg-pink-900/20 text-pink-300 text-sm font-bold hover:border-pink-400 transition">
                                          <Share2 className="w-3.5 h-3.5"/> {l({en:"Share on 小红书",zh:"分享到小红书"})}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Transport arrow between stops */}
                            {idx<plan.schedule.length-1 && (
                              <div className="absolute -bottom-2 left-6 bg-[#050f1a] px-3 py-1.5 rounded-full border border-blue-800/40 text-xs font-bold text-blue-300 flex items-center gap-1.5 z-10 shadow">
                                {stop.transport} · {stop.travelMin}min
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Send to friends */}
                    <div className="bg-[#0b1f35] rounded-2xl border border-green-900/30 p-5">
                      <div className="font-bold mb-3 flex items-center gap-2"><Send className="w-4 h-4 text-green-400"/> {l({en:"Send plan to friends",zh:"把行程发给朋友"})}</div>
                      <p className="text-sm text-gray-300 bg-[#050f1a] rounded-xl p-3 border border-blue-900/20 mb-3">{l(plan.summaryMessage)}</p>
                      <div className="flex flex-wrap gap-2">
                        {["💬 WeChat","📱 WhatsApp","📕 小红书","📸 Instagram","📘 Facebook"].map(ch=>(
                          <button key={ch} className="px-4 py-2 bg-[#050f1a] border border-blue-900/30 rounded-xl text-sm font-bold hover:border-green-400/50 hover:text-green-300 transition text-white">{ch}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BUDGET TAB ─── */}
                {activeTab==="budget" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Budget cap — manual input */}
                      <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                        <div className="text-xs text-gray-400 font-bold uppercase mb-2">{l({en:"Budget Cap",zh:"预算上限"})}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-bold">{CURRENCIES[currency].symbol}</span>
                          <input type="number"
                            value={Math.round(budget * CURRENCIES[currency].rate)}
                            onChange={e=>setBudget(Number(e.target.value)/CURRENCIES[currency].rate)}
                            className="flex-1 bg-transparent text-2xl font-black text-green-400 outline-none w-0" />
                        </div>
                        <div className="flex gap-2 mt-3">
                          {[-100,-50,50,100].map(d=>(
                            <button key={d} onClick={()=>setBudget(b=>Math.max(0,b+d/CURRENCIES[currency].rate))}
                              className="flex-1 py-1 rounded-lg bg-[#050f1a] border border-blue-900/30 text-xs font-bold text-gray-300 hover:border-blue-400">
                              {d>0?"+":""}{d}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Per person — syncs with people count */}
                      <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                        <div className="text-xs text-gray-400 font-bold uppercase mb-2">
                          {l({en:"Per Person",zh:"人均花费"})} <span className="text-yellow-400 normal-case">({people} {l({en:"pax",zh:"人"})})</span>
                        </div>
                        <div className="text-2xl font-black text-yellow-400">{fmt(Object.values(actualCosts).reduce((s,v)=>s+Number(v||0),0)/people,currency)}</div>
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={()=>setPeople(p=>Math.max(1,p-1))} className="p-1.5 rounded-lg bg-[#050f1a] border border-blue-900/30"><Minus className="w-3 h-3"/></button>
                          <span className="flex-1 text-center text-sm font-bold">{people} pax</span>
                          <button onClick={()=>setPeople(p=>p+1)} className="p-1.5 rounded-lg bg-[#050f1a] border border-blue-900/30"><Plus className="w-3 h-3"/></button>
                        </div>
                      </div>
                    </div>

                    {/* Actual spend tracker */}
                    <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">{l({en:"Actual spend tracker",zh:"实际花费记账"})}</h3>
                        <div className="text-sm font-black text-yellow-400">{l({en:"Total: ",zh:"总计: "})}{fmt(Object.values(actualCosts).reduce((s,v)=>s+Number(v||0),0),currency)}</div>
                      </div>
                      <div className="space-y-3">
                        {plan.schedule.map(stop=>(
                          <div key={stop.id} className="flex items-center justify-between py-2 border-b border-blue-900/20">
                            <div className="flex items-center gap-2">
                              <span>{stop.image||"📍"}</span>
                              <div>
                                <div className="text-sm font-bold text-white">{l(stop.place)}</div>
                                <div className="text-xs text-gray-400">{l({en:"Est: ",zh:"预估: "})}{fmt(stop.cost,currency)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-sm">{CURRENCIES[currency].symbol}</span>
                              <input type="number"
                                value={Math.round((actualCosts[stop.id]??stop.cost)*CURRENCIES[currency].rate)}
                                onChange={e=>setActualCosts(c=>({...c,[stop.id]:Number(e.target.value)/CURRENCIES[currency].rate}))}
                                className="w-24 bg-[#050f1a] border border-blue-900/30 rounded-xl px-3 py-2 text-center text-white font-bold outline-none focus:border-yellow-400 text-sm" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Execute actions */}
                    <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                      <h3 className="font-bold mb-4">{l({en:"⚡ One-tap execute",zh:"⚡ 一键执行"})}</h3>
                      <div className="flex gap-3 mb-4">
                        <button onClick={()=>setDoneActions({"confirm":true,"restaurant":true,"grab":true,"share":true})}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-yellow-400 text-gray-900 font-black text-sm">
                          {l({en:"Run all",zh:"全部执行"})}
                        </button>
                        <button onClick={()=>setDoneActions({})}
                          className="px-5 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm flex items-center gap-1.5">
                          <Undo2 className="w-4 h-4"/> {l({en:"Undo all",zh:"撤销全部"})}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {EXEC_ACTIONS.map(([id,icon,label])=>(
                          <div key={id} className={`flex items-center justify-between p-3 rounded-xl border transition ${doneActions[id]?"bg-green-900/20 border-green-500/30":"bg-[#050f1a] border-blue-900/30"}`}>
                            <div className="flex items-center gap-2">
                              <span>{icon}</span>
                              <span className="text-sm font-bold">{l(label as Bilingual)}</span>
                            </div>
                            <div className="flex gap-2">
                              {doneActions[id] && (
                                <button onClick={()=>setDoneActions(d=>({...d,[id]:false}))}
                                  className="px-2 py-1 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-900/40 transition">
                                  <Undo2 className="w-3 h-3"/>
                                </button>
                              )}
                              <button onClick={()=>setDoneActions(d=>({...d,[id]:!d[id]}))}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${doneActions[id]?"bg-green-600 text-white":"bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600"}`}>
                                {doneActions[id]?l({en:"Done ✓",zh:"完成 ✓"}):l({en:"Run",zh:"执行"})}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── REPLAN TAB ─── */}
                {activeTab==="replan" && (
                  <div className="space-y-5 relative">
                    {isReplanning && (
                      <div className="absolute inset-0 bg-[#050f1a]/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-3xl">
                        <RefreshCcw className="w-12 h-12 text-yellow-400 animate-spin mb-4"/>
                        <p className="font-black text-yellow-400 text-lg">{lang==="en"?"AI replanning…":"AI 正在重新规划…"}</p>
                      </div>
                    )}
                    <h2 className="text-2xl font-black">{l({en:"Something changed?",zh:"情况有变化？"})}</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {REPLAN_TRIGGERS.map(([id,icon,title,desc])=>(
                        <button key={id} onClick={()=>applyReplan(id as string)}
                          className="bg-[#0b1f35] p-5 rounded-2xl border border-blue-900/30 text-left hover:border-yellow-400/40 hover:bg-yellow-400/5 transition group">
                          <div className="text-2xl mb-2">{icon}</div>
                          <div className="font-black text-white group-hover:text-yellow-300 transition">{l(title as Bilingual)}</div>
                          <div className="text-xs text-gray-400 mt-1">{l(desc as Bilingual)}</div>
                        </button>
                      ))}
                    </div>
                    <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                      <h3 className="font-bold mb-3">{l({en:"✏️ Other situation",zh:"✏️ 其他情况"})}</h3>
                      <div className="flex gap-2">
                        <input value={customReplan} onChange={e=>setCustomReplan(e.target.value)}
                          placeholder={l({en:"Describe what changed…",zh:"描述发生了什么变化…"})}
                          className="flex-1 bg-[#050f1a] border border-blue-900/30 rounded-xl p-3 outline-none focus:border-yellow-400 text-sm text-white" />
                        <button onClick={()=>{if(customReplan.trim()){applyReplan(customReplan);setCustomReplan("");}}}
                          className="px-5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition">{l({en:"Apply",zh:"应用"})}</button>
                      </div>
                    </div>
                    {replanLog.length>0 && (
                      <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                        <h3 className="font-bold mb-3">{l({en:"Replan log",zh:"改行程记录"})}</h3>
                        <div className="space-y-2">
                          {replanLog.map((log,i)=>(
                            <div key={i} className="flex items-start gap-2 text-sm p-2 bg-[#050f1a] rounded-xl border border-blue-900/20">
                              <span className="text-blue-400 shrink-0">#{i+1}</span>
                              <span className="text-gray-300">{log}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── GROUP TAB ─── */}
                {activeTab==="group" && (
                  <div className="space-y-5">
                    {/* Phone handoff preview */}
                    <div className="flex gap-6">
                      <div className="w-[240px] shrink-0 bg-black border-[7px] border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="h-8 bg-black flex justify-center items-end pb-1"><div className="w-14 h-3 bg-gray-900 rounded-full"/></div>
                        <div className="bg-[#050f1a] p-4 min-h-[420px]">
                          <div className="text-xs font-black text-yellow-400 mb-2">PlanGo 旅享家</div>
                          <h3 className="text-sm font-black text-white mb-1">{l({en:"Approve this plan?",zh:"同意这个行程吗？"})}</h3>
                          <p className="text-xs text-gray-400 mb-3 leading-relaxed">{l(plan.summary)}</p>
                          {plan.schedule.slice(1,-1).map(s=>(
                            <div key={s.id} className="flex gap-2 pb-2 mb-2 border-b border-blue-900/20">
                              <span className="text-yellow-400 text-xs font-black w-14 shrink-0">{shiftTimeStr(s.time,timeOffset)}</span>
                              <span className="text-xs text-white font-bold leading-tight">{l(s.place)}</span>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-4">
                            <button className="flex-1 py-2 bg-red-900/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl">{l({en:"Reject",zh:"不同意"})}</button>
                            <button className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">{l({en:"Approve ✓",zh:"同意 ✓"})}</button>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                          <h3 className="font-bold mb-3 flex items-center gap-2"><Share2 className="w-4 h-4 text-blue-400"/>{l({en:"Share to",zh:"分享到"})}</h3>
                          <div className="grid grid-cols-2 gap-2">
  {/* WeChat: 微信通常使用浏览器打开会被拦截，我们提供复制分享码或简单的跳转提示 */}
  <button onClick={() => {
    navigator.clipboard.writeText(plan.summaryMessage.zh);
    alert("行程已复制到剪贴板，请在微信中粘贴发送！");
  }} className="px-4 py-3 bg-[#050f1a] border border-blue-900/30 rounded-xl text-sm font-bold text-white hover:border-green-400 transition text-left">
    💬 WeChat (复制文本)
  </button>

  {/* WhatsApp: 使用 wa.me 协议 */}
  <button onClick={() => {
    const text = encodeURIComponent(plan.summaryMessage.en);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }} className="px-4 py-3 bg-[#050f1a] border border-blue-900/30 rounded-xl text-sm font-bold text-white hover:border-green-400 transition text-left">
    📱 WhatsApp 分享
  </button>

  {/* 小红书: 复制内容 */}
  <button onClick={() => {
    navigator.clipboard.writeText(plan.summaryMessage.zh);
    alert("行程已复制，请打开小红书发布！");
  }} className="px-4 py-3 bg-[#050f1a] border border-blue-900/30 rounded-xl text-sm font-bold text-white hover:border-red-400 transition text-left">
    📕 复制小红书文案
  </button>

  {/* Facebook: 使用官方分享链接 */}
  <button onClick={() => {
    const url = window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  }} className="px-4 py-3 bg-[#050f1a] border border-blue-900/30 rounded-xl text-sm font-bold text-white hover:border-blue-400 transition text-left">
    🔵 Facebook 分享
  </button>
</div>
                        </div>
                        <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                          <h3 className="font-bold mb-3">{l({en:"Vote on each stop",zh:"逐站投票"})}</h3>
                          {plan.schedule.slice(1,-1).map(stop=>(
                            <div key={stop.id} className="flex items-center justify-between py-2 border-b border-blue-900/20 last:border-0">
                              <span className="text-sm font-bold text-white">{l(stop.place)}</span>
                              <div className="flex gap-2">
                                <button onClick={()=>setVotes(v=>({...v,[stop.id]:"yes"}))}
                                  className={`px-3 py-1 rounded-lg border text-xs font-bold transition ${votes[stop.id]==="yes"?"bg-green-600 border-green-500 text-white":"border-gray-700 text-gray-400 hover:border-green-400"}`}>👍</button>
                                <button onClick={()=>setVotes(v=>({...v,[stop.id]:"no"}))}
                                  className={`px-3 py-1 rounded-lg border text-xs font-bold transition ${votes[stop.id]==="no"?"bg-red-600 border-red-500 text-white":"border-gray-700 text-gray-400 hover:border-red-400"}`}>👎</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PAGE: MEMORY ═══════════════════════════════════════ */}
          {page==="memory" && (
            <div className="max-w-2xl mx-auto p-6 space-y-5">
              <h1 className="text-3xl font-black">{l({en:"🧠 Memory & Preferences",zh:"🧠 用户记忆与偏好"})}</h1>
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                {[
                  ["healthy",    {en:"🥗 Healthy/vegetarian food",zh:"🥗 健康或素食餐点"}],
                  ["avoidCrowds",{en:"😌 Avoid crowds",          zh:"😌 避开人潮"}],
                  ["family",     {en:"👨‍👩‍👧 Child-friendly",       zh:"👨‍👩‍👧 亲子设施"}],
                  ["grab",       {en:"🚗 Prefer Grab",            zh:"🚗 优先 Grab"}],
                  ["luxury",     {en:"💎 Luxury experiences",    zh:"💎 豪华体验"}],
                ].map(([id,label])=>{
                  const isOn = memories[id as string];
                  return (
                    <button key={id as string} onClick={()=>setMemories(m=>({...m,[id as string]:!m[id as string]}))}
                      className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition border-b border-blue-900/20 last:border-0">
                      <span className="font-bold">{l(label as Bilingual)}</span>
                      <div className={`w-12 h-6 rounded-full relative transition-colors ${isOn?"bg-yellow-400":"bg-gray-700"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow ${isOn?"left-7":"left-1"}`}/>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ PAGE: RECAP ════════════════════════════════════════ */}
          {page==="recap" && plan && (
            <div className="max-w-2xl mx-auto p-6 space-y-5">
              <div className="bg-gradient-to-br from-[#0b1f35] to-[#071427] rounded-3xl p-8 border border-blue-900/30 shadow-2xl">
                <div className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-2">PlanGo 旅享家</div>
                <h2 className="text-4xl font-black mb-6">{l({en:"Trip Complete 🎉",zh:"旅程圆满结束 🎉"})}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#050f1a]/50 rounded-2xl p-4">
                    <div className="text-xs text-gray-400 uppercase font-bold mb-1">{l({en:"Total spent",zh:"总花费"})}</div>
                    <div className="text-3xl font-black text-yellow-400">{fmt(Object.values(actualCosts).reduce((s,v)=>s+Number(v||0),0)||plan.totalCost,currency)}</div>
                  </div>
                  <div className="bg-[#050f1a]/50 rounded-2xl p-4">
                    <div className="text-xs text-gray-400 uppercase font-bold mb-1">{l({en:"Stops visited",zh:"经过站点"})}</div>
                    <div className="text-3xl font-black text-white">{plan.schedule.length}</div>
                  </div>
                </div>
              </div>

              {/* Packing list */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-400"/>{l({en:"Packing checklist",zh:"行李清单"})}</h3>
                {plan.packing.map(cat=>(
                  <div key={cat.category.en} className="mb-4">
                    <div className="text-xs font-bold text-yellow-400 uppercase mb-2">{l(cat.category)}</div>
                    <div className="space-y-2">
                      {cat.items.map((item,i)=>(
                        <button key={i} onClick={()=>setPackingDone(d=>({...d,[`${cat.category.en}-${i}`]:!d[`${cat.category.en}-${i}`]}))}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${packingDone[`${cat.category.en}-${i}`]?"bg-green-900/20 border-green-500/30 text-green-300":"bg-[#050f1a] border-blue-900/30 text-gray-300"}`}>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${packingDone[`${cat.category.en}-${i}`]?"border-green-500 bg-green-500":"border-gray-600"}`}>
                            {packingDone[`${cat.category.en}-${i}`] && <CheckCircle2 className="w-3 h-3 text-white"/>}
                          </div>
                          <span className="text-sm font-bold text-left">{l(item)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Emergency */}
              <div className="bg-red-900/10 rounded-2xl border border-red-900/30 p-5">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-400"/>{l({en:"Emergency contacts",zh:"紧急联系"})}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {plan.emergency.map(e=>(
                    <a key={e.number} href={`tel:${e.number}`}
                      className="flex items-center gap-3 p-3 bg-[#050f1a] border border-red-900/30 rounded-xl hover:border-red-400/50 transition">
                      <span className="text-xl">{e.icon}</span>
                      <div>
                        <div className="text-xs text-gray-400 font-bold">{l(e.label)}</div>
                        <div className="text-sm font-black text-red-300 font-mono">{e.number}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Local notes */}
              <div className="bg-[#0b1f35] rounded-2xl border border-blue-900/30 p-5">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-400"/>{l({en:"Local notes",zh:"注意事项"})}</h3>
                <div className="space-y-3">
                  {plan.notes.map((note,i)=>(
                    <div key={i} className="flex gap-3 p-3 bg-[#050f1a] rounded-xl border border-blue-900/20">
                      <span className="text-xl shrink-0">{note.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-yellow-400 uppercase mb-1">{l(note.label)}</div>
                        <div className="text-sm text-gray-300 leading-relaxed">{l(note.value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────

function Counter({ label, value, onChange }: { label:string; value:number; onChange:(v:number)=>void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">{label}:</span>
      <button onClick={()=>onChange(Math.max(0,value-1))} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"><Minus className="w-3 h-3"/></button>
      <span className="w-8 text-center font-black text-yellow-400">{value}</span>
      <button onClick={()=>onChange(value+1)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"><Plus className="w-3 h-3"/></button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────

const AGENT_CARDS = [
  {icon:"🧠",en:"Planner Agent",  zh:"行程智能体"},
  {icon:"🍽️",en:"Food Agent",    zh:"餐厅智能体"},
  {icon:"💰",en:"Budget Agent",  zh:"预算智能体"},
  {icon:"🚨",en:"Safety Agent",  zh:"安全智能体"},
  {icon:"📋",en:"Booking Agent", zh:"预订智能体"},
  {icon:"🌤️",en:"Weather Agent", zh:"天气智能体"},
];

const NAV_ITEMS = [
  { id:"planner", label:{en:"Planner",    zh:"规划"},      icon: MessageSquare },
  { id:"qna",     label:{en:"Smart QnA",  zh:"智能追问"},  icon: HelpCircle },
  { id:"main",    label:{en:"My Trip",    zh:"我的行程"},  icon: CalendarClock },
  { id:"memory",  label:{en:"Memory",     zh:"用户记忆"},  icon: BrainCircuit },
  { id:"recap",   label:{en:"Recap",      zh:"回顾总结"},  icon: Flag },
];

const TAB_ICONS: Record<string,React.ReactNode> = {
  schedule: <CalendarClock className="w-4 h-4"/>,
  budget:   <Wallet className="w-4 h-4"/>,
  replan:   <RefreshCcw className="w-4 h-4"/>,
  group:    <Share2 className="w-4 h-4"/>,
};

const TAB_LABELS: Record<string,Bilingual> = {
  schedule: {en:"Schedule",    zh:"时间表"},
  budget:   {en:"Budget",      zh:"财务"},
  replan:   {en:"Live Replan", zh:"实时重绘"},
  group:    {en:"Group Vote",  zh:"群组分享"},
};

const EXEC_ACTIONS: [string,string,Bilingual][] = [
  ["confirm",    "📋", {en:"Lock schedule",        zh:"锁定行程"}],
  ["restaurant", "🍽️", {en:"Book restaurant",      zh:"餐厅订位"}],
  ["tickets",    "🎫", {en:"Buy attraction tickets",zh:"购买门票"}],
  ["grab",       "🚗", {en:"Schedule Grab pickup",  zh:"预约 Grab"}],
  ["cake",       "🎂", {en:"Order cake/flowers",    zh:"订蛋糕/鲜花"}],
  ["share",      "💬", {en:"Send to friends",       zh:"发给朋友"}],
  ["save",       "💾", {en:"Save to memory",        zh:"保存记忆"}],
];

const REPLAN_TRIGGERS: [string,string,Bilingual,Bilingual][] = [
  ["rain",   "🌧️", {en:"It's raining",    zh:"突然下雨了"},  {en:"Switch to indoor alternatives",zh:"全切室内方案"}],
  ["full",   "🚫", {en:"Restaurant full",  zh:"餐厅没位置"},  {en:"Find nearby backup",zh:"寻找附近后备"}],
  ["traffic","🚗", {en:"Traffic jam",      zh:"大堵车"},      {en:"Push ETA back 20min",zh:"整体延后20分钟"}],
  ["budget", "💸", {en:"Over budget",      zh:"超预算了"},    {en:"Switch to cheaper alternatives",zh:"换成实惠选项"}],
  ["tired",  "😴", {en:"Group is tired",   zh:"太累了"},      {en:"Shorten and head back",zh:"缩短行程提早回"}],
  ["closed", "🔒", {en:"Attraction closed",zh:"景点关闭了"},  {en:"Find similar nearby",zh:"寻找附近类似景点"}],
];