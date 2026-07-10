import type { MarketListingInput } from "@/lib/services/market-alerts";

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export type EmailAlertPayload = {
  source_key: string;
  subject?: string;
  text?: string;
  html?: string;
  received_at?: string;
};

export function parseEmailAlertListings(payload: EmailAlertPayload): MarketListingInput[] {
  const body = [payload.subject, payload.text, payload.html].filter(Boolean).join("\n");
  const urls = Array.from(new Set(body.match(URL_PATTERN) ?? []))
    .map(cleanUrl)
    .filter((url) => isLikelyListingUrl(url, payload.source_key));

  return urls.map((url, index) => ({
    source_key: payload.source_key,
    source_listing_id: url,
    listing_url: url,
    title: payload.subject ?? `Email alert listing ${index + 1}`,
    raw: {
      source: "email_alert",
      subject: payload.subject,
      received_at: payload.received_at,
    },
  }));
}

function cleanUrl(url: string) {
  return url.replace(/[.,;:!?]+$/, "");
}

function isLikelyListingUrl(url: string, sourceKey: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host.includes("google.") || host.includes("facebook.") || host.includes("instagram.")) return false;
    if (sourceKey === "mobile_de") return host.includes("mobile.de");
    if (sourceKey === "truckscout24") return host.includes("truckscout24.");
    if (sourceKey === "autoline") return host.includes("autoline.");
    if (sourceKey === "autoscout24") return host.includes("autoscout24.");
    if (sourceKey === "truck1") return host.includes("truck1.");
    if (sourceKey === "leboncoin") return host.includes("leboncoin.");
    if (sourceKey === "autotrader_uk") return host.includes("autotrader.co.uk");
    if (sourceKey === "machineryline") return host.includes("machineryline.");
    if (sourceKey === "machineseeker") return host.includes("machineseeker.");
    if (sourceKey === "wallapop") return host.includes("wallapop.");
    if (sourceKey === "trucksnl") return host.includes("trucksnl.");
    if (sourceKey === "mascus") return host.includes("mascus.");
    if (sourceKey === "agriaffaires") return host.includes("agriaffaires.");
    if (sourceKey === "europe_camions") return host.includes("europe-camions.");
    if (sourceKey === "kleyn_trucks") return host.includes("kleyntrucks.");
    if (sourceKey === "bas_world") return host.includes("basworld.");
    return true;
  } catch {
    return false;
  }
}
