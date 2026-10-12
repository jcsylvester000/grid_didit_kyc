// Sample data for the prototype. Names, listings and addresses are invented.

export type Listing = {
  id: string;
  title: string;
  area: string; // public, approximate location
  exactAddress: string; // unlocked only after identity verification
  type: string;
  beds: number;
  baths: number;
  sqm: number;
  rentPhp: number; // monthly rent, whole pesos
  owner: string;
  ownerAuthorized: boolean;
  city: "Metro Manila" | "Cebu";
  slots: string[];
};

export const LISTINGS: Listing[] = [
  {
    id: "bgc-uptown-1br",
    title: "1BR corner unit with city view",
    area: "Uptown, Bonifacio Global City, Taguig",
    exactAddress: "Unit 2814, Tower 2, Uptown Parksuites, 36th St cor 9th Ave, BGC, Taguig",
    type: "Condominium",
    beds: 1,
    baths: 1,
    sqm: 52,
    rentPhp: 45000,
    owner: "Owner (OFW, Dubai)",
    ownerAuthorized: true,
    city: "Metro Manila",
    slots: ["Sat 17 Oct · 10:00 AM", "Sat 17 Oct · 2:00 PM", "Sun 18 Oct · 11:00 AM"],
  },
  {
    id: "rockwell-2br",
    title: "2BR family suite near Power Plant Mall",
    area: "Rockwell Center, Makati",
    exactAddress: "Unit 17B, Edades Tower, Rockwell Drive, Rockwell Center, Makati",
    type: "Condominium",
    beds: 2,
    baths: 2,
    sqm: 98,
    rentPhp: 95000,
    owner: "Private owner",
    ownerAuthorized: true,
    city: "Metro Manila",
    slots: ["Fri 16 Oct · 6:00 PM", "Sat 17 Oct · 9:00 AM"],
  },
  {
    id: "ortigas-studio",
    title: "Furnished studio, walk to MRT",
    area: "Ortigas Center, Pasig",
    exactAddress: "Unit 1203, One Oasis Tower, Ortigas Ave Ext, Pasig",
    type: "Condominium",
    beds: 0,
    baths: 1,
    sqm: 26,
    rentPhp: 18000,
    owner: "Broker-managed",
    ownerAuthorized: false,
    city: "Metro Manila",
    slots: ["Thu 15 Oct · 7:00 PM", "Sat 17 Oct · 1:00 PM", "Sun 18 Oct · 3:00 PM"],
  },
  {
    id: "alabang-house",
    title: "3BR house with garden",
    area: "Ayala Alabang, Muntinlupa",
    exactAddress: "14 Acacia Ave, Ayala Alabang Village, Muntinlupa",
    type: "House and lot",
    beds: 3,
    baths: 3,
    sqm: 240,
    rentPhp: 150000,
    owner: "Private owner",
    ownerAuthorized: true,
    city: "Metro Manila",
    slots: ["Sat 17 Oct · 11:00 AM", "Sun 18 Oct · 10:00 AM"],
  },
  {
    id: "cebu-itpark-1br",
    title: "1BR near Cebu IT Park",
    area: "Lahug, Cebu City",
    exactAddress: "Unit 905, Avida Riala Tower 3, Lahug, Cebu City",
    type: "Condominium",
    beds: 1,
    baths: 1,
    sqm: 34,
    rentPhp: 22000,
    owner: "Owner (OFW, Singapore)",
    ownerAuthorized: true,
    city: "Cebu",
    slots: ["Sat 17 Oct · 3:00 PM", "Mon 19 Oct · 6:30 PM"],
  },
  {
    id: "qc-maginhawa-2br",
    title: "2BR townhouse near UP Diliman",
    area: "Teachers Village, Quezon City",
    exactAddress: "22-B Maginhawa St, Teachers Village East, Quezon City",
    type: "Townhouse",
    beds: 2,
    baths: 2,
    sqm: 110,
    rentPhp: 38000,
    owner: "Broker-managed",
    ownerAuthorized: false,
    city: "Metro Manila",
    slots: ["Sun 18 Oct · 9:00 AM", "Sun 18 Oct · 4:00 PM"],
  },
];

export const getListing = (id: string | null | undefined) => LISTINGS.find((l) => l.id === id);

export type DemoUser = { id: string; name: string; email: string; role: "tenant" | "owner" | "broker"; note: string };

export const DEMO_USERS: DemoUser[] = [
  { id: "demo-tenant-maria", name: "Maria Santos", email: "maria@example.com", role: "tenant", note: "New tenant, not verified" },
  { id: "demo-tenant-paolo", name: "Paolo Reyes", email: "paolo@example.com", role: "tenant", note: "Returning tenant, already verified" },
  { id: "demo-tenant-ana", name: "Ana Cruz", email: "ana@example.com", role: "tenant", note: "New tenant (OFW, uses passport)" },
];

export const DEFAULT_USER_ID = DEMO_USERS[0].id;
export const getDemoUser = (id: string | null | undefined) => DEMO_USERS.find((u) => u.id === id);

export const ID_TYPES = [
  { value: "philid", label: "PhilID / ePhilID", hint: "National ID" },
  { value: "passport", label: "Passport", hint: "Best for OFWs abroad" },
  { value: "drivers_license", label: "Driver's License", hint: "LTO" },
  { value: "umid", label: "UMID", hint: "SSS / GSIS" },
  { value: "prc", label: "PRC ID", hint: "Licensed professionals" },
] as const;
export type IdType = (typeof ID_TYPES)[number]["value"];
export const isIdType = (v: unknown): v is IdType => ID_TYPES.some((t) => t.value === v);
export const idTypeLabel = (v: string | null | undefined) => ID_TYPES.find((t) => t.value === v)?.label ?? v ?? "—";

// Consent wording is versioned; every consent record stores the version shown.
export const CONSENT_VERSION = "2026-10-12.v1";
export const CONSENT_CHECKBOX =
  "I agree to Grid and Didit processing my ID and face image to verify my identity for this purpose.";

// Didit list prices (US$) as of 2 Oct 2026 — Readiness Report §3.1. Peso at 62.76 (1 Oct 2026).
export const PRICING = {
  freePerFeature: 500,
  alertAt: 400,
  usdToPhp: 62.76,
  features: [
    { key: "id", label: "ID Verification", usd: 0.15 },
    { key: "liveness", label: "Passive Liveness", usd: 0.1 },
    { key: "face", label: "Face Match", usd: 0.05 },
    { key: "ip", label: "Device & IP Analysis", usd: 0.03 },
  ],
} as const;

export const formatPhp = (n: number) => "₱" + n.toLocaleString("en-PH");
