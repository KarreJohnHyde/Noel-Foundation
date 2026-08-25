import { contact } from "../content";

export type PublicFormKind = "contact" | "volunteer" | "csr" | "feedback";

export type ImpactMetric = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  description: string | null;
  programme: string | null;
  source: string | null;
  updated_at: string;
};

export type PublicFormPayload = {
  kind: PublicFormKind;
  submissionId: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  organisation?: string;
  subject?: string;
  message?: string;
  cause?: string;
  availability?: string;
  skills?: string;
  areaOfInterest?: string;
  experience?: string;
  communicationPreference?: string;
  partnershipModel?: string;
  outcomeGoal?: string;
  rating?: number;
  pageContext?: string;
  consent: boolean;
  website?: string;
  startedAt: number;
  turnstileToken?: string;
};

export type PublicFormResult =
  | { delivered: true; reference: string }
  | {
      delivered: false;
      fallbackHref: string;
    };

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export type DonationCheckoutPayload = {
  submissionId: string;
  amount: number;
  frequency: "One Time" | "Monthly";
  cause: string;
  name: string;
  email: string;
  phone?: string;
  turnstileToken: string;
};

export type DonationCheckoutResult = {
  url: string;
  reference: string;
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function fallbackMailto(payload: PublicFormPayload) {
  const subject = encodeURIComponent(
    payload.kind === "volunteer"
      ? `Volunteer enquiry - ${payload.cause || "Noel Foundation"}`
      : payload.kind === "csr"
        ? `CSR partnership enquiry - ${payload.organisation || payload.name}`
        : payload.kind === "feedback"
          ? "Noel Foundation website feedback"
          : payload.subject || "Website enquiry",
  );

  const lines = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : "",
    payload.city ? `City: ${payload.city}` : "",
    payload.organisation ? `Organisation: ${payload.organisation}` : "",
    payload.cause ? `Program / cause: ${payload.cause}` : "",
    payload.partnershipModel ? `Partnership model: ${payload.partnershipModel}` : "",
    payload.outcomeGoal ? `Outcome goal: ${payload.outcomeGoal}` : "",
    payload.availability ? `Availability: ${payload.availability}` : "",
    payload.skills ? `Skills: ${payload.skills}` : "",
    payload.areaOfInterest ? `Area of interest: ${payload.areaOfInterest}` : "",
    payload.experience ? `Experience: ${payload.experience}` : "",
    payload.communicationPreference
      ? `Communication preference: ${payload.communicationPreference}`
      : "",
    payload.rating ? `Experience rating: ${payload.rating}/5` : "",
    payload.pageContext ? `Page: ${payload.pageContext}` : "",
    "",
    payload.message || "",
  ].filter(Boolean);

  return `mailto:${contact.email}?subject=${subject}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export async function createDonationCheckout(
  payload: DonationCheckoutPayload,
): Promise<DonationCheckoutResult> {
  if (!supabaseUrl || !publishableKey || !turnstileSiteKey) {
    throw new Error("Secure online checkout is not configured yet.");
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/create-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
        },
        body: JSON.stringify(payload),
      },
      15_000,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Secure checkout timed out. Please try again.");
    }
    throw error;
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error || "Secure checkout could not be started.");
  }

  return (await response.json()) as DonationCheckoutResult;
}

export async function submitPublicForm(payload: PublicFormPayload): Promise<PublicFormResult> {
  if (!supabaseUrl || !publishableKey || !turnstileSiteKey) {
    return { delivered: false, fallbackHref: fallbackMailto(payload) };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/public-form`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
        },
        body: JSON.stringify(payload),
      },
      12_000,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The request timed out. Please check your connection and try again.");
    }
    throw error;
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(error?.error || "We could not send your enquiry. Please try again.");
  }

  const data = (await response.json()) as { reference: string };
  return { delivered: true, reference: data.reference };
}

let impactMetricsRequest: Promise<ImpactMetric[]> | null = null;

export function fetchPublicImpactMetrics(): Promise<ImpactMetric[]> {
  if (!supabaseUrl || !publishableKey) return Promise.resolve([]);
  if (impactMetricsRequest) return impactMetricsRequest;

  const columns = [
    "key",
    "label",
    "value",
    "unit",
    "description",
    "programme",
    "source",
    "updated_at",
  ].join(",");

  impactMetricsRequest = (async () => {
    try {
      const response = await fetchWithTimeout(
        `${supabaseUrl}/rest/v1/impact_metrics?select=${columns}&verification_status=eq.verified&public_visibility=eq.true&order=display_order.asc`,
        {
          headers: {
            apikey: publishableKey,
          },
        },
        8_000,
      );

      if (!response.ok) throw new Error("The public impact service is temporarily unavailable.");
      return (await response.json()) as ImpactMetric[];
    } finally {
      impactMetricsRequest = null;
    }
  })();

  return impactMetricsRequest;
}

export const impactBackendConfigured = Boolean(supabaseUrl && publishableKey);
export const backendConfigured = Boolean(impactBackendConfigured && turnstileSiteKey);
export const checkoutBackendConfigured = backendConfigured;
