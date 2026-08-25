import Stripe from "npm:stripe@22.4.0";

const MAX_BODY_BYTES = 8192;
const causes = new Set([
  "Where Needed Most",
  "Children's Health",
  "Education",
  "Women's Livelihoods",
]);

type JsonRecord = Record<string, unknown>;

class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function readKeyMap(name: string) {
  const raw = Deno.env.get(name);
  if (!raw) return [];
  try {
    return Object.values(JSON.parse(raw) as JsonRecord).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  } catch {
    return [];
  }
}

function readServiceKey() {
  return (
    readKeyMap("SUPABASE_SECRET_KEYS")[0] ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    null
  );
}

function readPublishableKeys() {
  return new Set(
    [
      ...readKeyMap("SUPABASE_PUBLISHABLE_KEYS"),
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
      Deno.env.get("SUPABASE_ANON_KEY"),
    ].filter((value): value is string => Boolean(value)),
  );
}

function allowedOrigins() {
  const configured = Deno.env.get("PUBLIC_SITE_ORIGINS");
  return new Set(
    (configured
      ? configured.split(",")
      : [
          "https://noelfoundation.in",
          "https://www.noelfoundation.in",
          "http://localhost:8443",
          "http://127.0.0.1:8443",
        ]
    )
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function responseHeaders(origin: string, allowed: boolean) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return headers;
}

function json(status: number, body: JsonRecord, origin: string, allowed: boolean) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, allowed),
  });
}

function serviceHeaders(serviceKey: string, prefer = "") {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
  };
  if (serviceKey.split(".").length === 3) headers.Authorization = `Bearer ${serviceKey}`;
  if (prefer) headers.Prefer = prefer;
  return headers;
}

function requiredText(payload: JsonRecord, key: string, min: number, max: number) {
  const raw = payload[key];
  if (typeof raw !== "string") throw new RequestError(400, `${key} is required.`);
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new RequestError(400, `${key} is invalid.`);
  }
  return value;
}

function optionalText(payload: JsonRecord, key: string, max: number) {
  const raw = payload[key];
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new RequestError(400, `${key} is invalid.`);
  const value = raw.trim();
  if (value.length > max) throw new RequestError(400, `${key} is invalid.`);
  return value || null;
}

function makeReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const random = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `NF-D-${date}-${random}`;
}

async function verifyTurnstile(
  request: Request,
  token: string,
  submissionId: string,
  origins: Set<string>,
) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) throw new RequestError(503, "Secure checkout is not configured.");
  const body = new URLSearchParams({ secret, response: token, idempotency_key: submissionId });
  const address =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (address) body.set("remoteip", address);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new RequestError(503, "Human verification is unavailable.");
  const result = (await response.json()) as {
    success?: boolean;
    action?: string;
    hostname?: string;
  };
  const hostnames = new Set(Array.from(origins, (value) => new URL(value).hostname));
  if (
    !result.success ||
    result.action !== "donate" ||
    !result.hostname ||
    !hostnames.has(result.hostname)
  ) {
    throw new RequestError(403, "Human verification failed.");
  }
}

async function rest<T>(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serviceHeaders(serviceKey, init.method === "POST" ? "return=representation" : ""),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    console.error("create-checkout database request failed", path, response.status);
    throw new RequestError(503, "Secure checkout is temporarily unavailable.");
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const origins = allowedOrigins();
  const allowed = origins.has(origin);
  if (request.method === "OPTIONS") {
    return allowed
      ? new Response(null, { status: 204, headers: responseHeaders(origin, true) })
      : json(403, { error: "Origin is not allowed." }, origin, false);
  }
  if (request.method !== "POST")
    return json(405, { error: "Method not allowed." }, origin, allowed);
  if (!allowed) return json(403, { error: "Origin is not allowed." }, origin, false);

  const publishableKeys = readPublishableKeys();
  if (!publishableKeys.has(request.headers.get("apikey") || "")) {
    return json(401, { error: "A publishable API key is required." }, origin, true);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = readServiceKey();
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey || !stripeKey || !Deno.env.get("TURNSTILE_SECRET_KEY")) {
    return json(503, { error: "Secure checkout is not configured." }, origin, true);
  }

  try {
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > MAX_BODY_BYTES) throw new RequestError(413, "The request is too large.");
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      throw new RequestError(413, "The request is too large.");
    }
    const payload = JSON.parse(raw) as JsonRecord;
    const submissionId = requiredText(payload, "submissionId", 36, 36);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)
    ) {
      throw new RequestError(400, "submissionId is invalid.");
    }
    const amount = payload.amount;
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 100 ||
      amount > 10_000_000
    ) {
      throw new RequestError(400, "amount is invalid.");
    }
    const frequency = requiredText(payload, "frequency", 3, 20);
    if (frequency !== "One Time" && frequency !== "Monthly") {
      throw new RequestError(400, "frequency is invalid.");
    }
    const cause = requiredText(payload, "cause", 2, 120);
    if (!causes.has(cause)) throw new RequestError(400, "cause is invalid.");
    const name = requiredText(payload, "name", 2, 120);
    const email = requiredText(payload, "email", 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError(400, "email is invalid.");
    const phone = optionalText(payload, "phone", 40);
    if (phone && !/^[+0-9().\s-]{5,40}$/.test(phone))
      throw new RequestError(400, "phone is invalid.");
    const turnstileToken = requiredText(payload, "turnstileToken", 10, 2048);
    await verifyTurnstile(request, turnstileToken, submissionId, origins);

    const stripe = new Stripe(stripeKey);
    const prior = await rest<
      Array<{ reference: string; stripe_checkout_session_id: string | null }>
    >(
      supabaseUrl,
      serviceKey,
      `donations?select=reference,stripe_checkout_session_id&submission_id=eq.${submissionId}&limit=1`,
    );
    if (prior[0]?.stripe_checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(prior[0].stripe_checkout_session_id);
      if (session.url)
        return json(200, { url: session.url, reference: prior[0].reference }, origin, true);
    }

    const donors = await rest<Array<{ id: number }>>(
      supabaseUrl,
      serviceKey,
      `donors?select=id&email=eq.${encodeURIComponent(email)}&limit=1`,
    );
    let donorId = donors[0]?.id;
    if (!donorId) {
      const inserted = await rest<Array<{ id: number }>>(supabaseUrl, serviceKey, "donors", {
        method: "POST",
        body: JSON.stringify({
          full_name: name,
          email,
          phone,
          consent_at: new Date().toISOString(),
        }),
      });
      donorId = inserted[0].id;
    }

    const reference = prior[0]?.reference || makeReference();
    if (!prior[0]) {
      await rest(supabaseUrl, serviceKey, "donations", {
        method: "POST",
        body: JSON.stringify({
          submission_id: submissionId,
          reference,
          donor_id: donorId,
          amount,
          currency: "INR",
          designation: cause,
          frequency: frequency === "Monthly" ? "monthly" : "one_time",
          payment_provider: "stripe",
          status: "pending",
        }),
      });
    }

    const recurring = frequency === "Monthly" ? { interval: "month" as const } : undefined;
    const session = await stripe.checkout.sessions.create(
      {
        mode: frequency === "Monthly" ? "subscription" : "payment",
        submit_type: "donate",
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "inr",
              unit_amount: amount * 100,
              recurring,
              product_data: {
                name: `Noel Foundation — ${cause}`,
                description:
                  frequency === "Monthly"
                    ? "Monthly charitable contribution"
                    : "One-time charitable contribution",
              },
            },
          },
        ],
        metadata: { donation_reference: reference, submission_id: submissionId, cause },
        ...(frequency === "Monthly"
          ? {
              subscription_data: {
                metadata: { donation_reference: reference, submission_id: submissionId },
              },
            }
          : {
              payment_intent_data: {
                metadata: { donation_reference: reference, submission_id: submissionId },
              },
            }),
        success_url: `${origin}/donate?payment=success&reference=${encodeURIComponent(reference)}`,
        cancel_url: `${origin}/donate?payment=cancelled`,
      },
      { idempotencyKey: `noel-donation-${submissionId}` },
    );
    if (!session.url) throw new RequestError(503, "Stripe did not return a checkout URL.");

    await rest(supabaseUrl, serviceKey, `donations?submission_id=eq.${submissionId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        payment_reference: session.id,
        stripe_checkout_session_id: session.id,
      }),
    });
    return json(201, { url: session.url, reference }, origin, true);
  } catch (error) {
    if (error instanceof RequestError)
      return json(error.status, { error: error.message }, origin, true);
    if (error instanceof SyntaxError)
      return json(400, { error: "The request body is invalid." }, origin, true);
    console.error(
      "create-checkout failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return json(500, { error: "Secure checkout could not be started." }, origin, true);
  }
});
