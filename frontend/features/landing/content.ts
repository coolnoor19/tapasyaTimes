import { Armchair, CalendarRange, Footprints, type LucideIcon } from "lucide-react";
import type { SeatTier } from "./types";

// Every word and look on the landing page that is not live data sits in this file, so the team can change
// the wording without touching any layout code.
//
// NOTE FOR THE OWNER: the tier descriptions and the FAQ are starting text. Replace them with your real
// amenities and policies. (Prices, seat counts and opening hours are NOT here: they come live from the system.)

export const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: CalendarRange,
    title: "Pick your days and hours",
    text: "Choose a time slot, then one day or a whole stretch of days. You can book up to 31 days at once.",
  },
  {
    icon: Armchair,
    title: "Choose your exact seat",
    text: "See the live seat map. Taken seats are clearly marked, so you only ever pick one that is free.",
  },
  {
    icon: Footprints,
    title: "Walk in and work",
    text: "Your seat is held for 10 minutes while you check out. After that, it is yours for every day you booked.",
  },
];

// Looks per tier. Full class names are written out so Tailwind can find them.
export const TIERS: Record<
  SeatTier,
  { name: string; tagline: string; description: string; accent: string; soft: string; border: string; dot: string }
> = {
  EXECUTIVE: {
    name: "Executive",
    tagline: "Premium desks",
    description: "Our top-tier seats for long, focused work and important calls.",
    accent: "text-tier-executive",
    soft: "bg-brand-50",
    border: "border-brand-200 hover:border-tier-executive",
    dot: "bg-tier-executive",
  },
  PROFESSIONAL: {
    name: "Professional",
    tagline: "Comfortable everyday desks",
    description: "A comfortable seat for everyday work, meetings and deadlines.",
    accent: "text-tier-professional",
    soft: "bg-[#e6f6f7]",
    border: "border-[#a9dde1] hover:border-tier-professional",
    dot: "bg-tier-professional",
  },
  STUDY: {
    name: "Study",
    tagline: "Quiet, affordable seats",
    description: "A calm, budget-friendly seat for studying and reading.",
    accent: "text-tier-study",
    soft: "bg-leaf-50",
    border: "border-leaf-200 hover:border-tier-study",
    dot: "bg-tier-study",
  },
};

export const TIER_ORDER: SeatTier[] = ["EXECUTIVE", "PROFESSIONAL", "STUDY"];

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "Do I need an account to book?",
    answer: "Yes. Create a free account with your email and mobile number, confirm the 6-digit code we email you, and you can book straight away.",
  },
  {
    question: "How long is my seat held while I check out?",
    answer: "Ten minutes. During that time nobody else can take your seat. If the time runs out before you finish, the seat is released for others.",
  },
  {
    question: "Can I book several days at once?",
    answer: "Yes, up to 31 days in one booking. You get the same seat in the same time slot on every day you choose, and a seat is only offered if it is free on all of them.",
  },
  {
    question: "What is the difference between the seat types?",
    answer: "Each type has its own hourly price and its own area on the seat map. The prices and the number of seats of each type are shown live on this page.",
  },
  {
    question: "What are the opening hours?",
    answer: "Seats are booked in fixed time slots. The current slots are listed on this page and update automatically when the workspace changes them.",
  },
];
