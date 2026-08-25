const MAX_BODY_BYTES = 16_384;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const contactSubjects = new Set([
  "CSR partnership",
  "Donation",
  "Volunteer",
  "Program information",
  "Media or general enquiry",
]);
const volunteerCauses = new Set([
  "Children's Health",
  "Education",
  "Women's Livelihoods",
  "Community Outreach",
  "Employee Volunteering",
]);
const availabilityOptions = new Set(["Weekdays", "Weekends", "Both", "Flexible"]);
const communicationOptions = new Set(["Email", "Phone", "WhatsApp"]);
const csrProgrammes = new Set(["Children's Health", "Education", "Women's Livelihoods"]);
const partnershipModels = new Set([
  "Program Sponsorship",
  "Beneficiary Sponsorship",
  "Project Partnership",
  "Employee Engagement",
  "Strategic Partnership",
]);
const outcomeGoals = new Set([
  "Healthier children",
  "Education continuity",
  "Women's earning pathways",
  "Community resilience",
]);

const allowedFields = new Set([
  "kind",
  "submissionId",
  "name",
  "email",
  "phone",
  "city",
  "organisation",
  "subject",
  "message",
  "cause",
  "availability",
  "skills",
  "areaOfInterest",
  "experience",
  "communicationPreference",
  "partnershipModel",
  "outcomeGoal",
  "consent",
  "website",
  "startedAt",
  "turnstileToken",
]);

type FormKind = "contact" | "volunteer" | "csr";
type JsonRecord = Record<string, unknown>;

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAllowedOrigins() {
  const configured = Deno.env.get("PUBLIC_SITE_ORIGINS");
  const source = configured
    ? configured.split(",")
    : [
        "https://noelfoundation.in",
        "https://www.noelfoundation.in",
        "http://localhost:8443",
        "http://127.0.0.1:8443",
      ];

  return new Set(source.map((value) => value.trim()).filter(Boolean));
}

function readKeyMap(name: string) {
  const raw = Deno.env.get(name);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.values(parsed).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  } catch {
    console.error("public-form key configuration is invalid", name);
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

function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwarded ||
    "unknown"
  );
}

function responseHeaders(origin: string, allowed: boolean) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };

  if (origin && allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Max-Age"] = "86400";
  }

  return headers;
}

function jsonResponse(status: number, body: JsonRecord, origin: string, allowed: boolean) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, allowed),
  });
}

function readString(
  payload: JsonRecord,
  key: string,
  options: { required?: boolean; min?: number; max: number },
) {
  const raw = payload[key];
  if (raw === undefined || raw === null || raw === "") {
    if (options.required) throw new RequestError(400, `${key} is required.`);
    return null;
  }
  if (typeof raw !== "string") throw new RequestError(400, `${key} must be text.`);

  const value = raw.trim();
  if (!value && options.required) throw new RequestError(400, `${key} is required.`);
  if (value.length < (options.min ?? 0) || value.length > options.max) {
    throw new RequestError(400, `${key} has an invalid length.`);
  }
  return value || null;
}

function requireOption(value: string | null, options: Set<string>, field: string) {
  if (!value || !options.has(value)) throw new RequestError(400, `${field} is invalid.`);
  return value;
}

function makeReference(kind: FormKind) {
  const prefixes: Record<FormKind, string> = {
    contact: "C",
    volunteer: "V",
    csr: "P",
  };
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const random = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `NF-${prefixes[kind]}-${date}-${random}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

async function existingReference(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  submissionId: string,
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=reference&submission_id=eq.${encodeURIComponent(submissionId)}&limit=1`,
    { headers: serviceHeaders(serviceKey) },
  );
  if (!response.ok) throw new RequestError(503, "The form service is temporarily unavailable.");
  const rows = (await response.json()) as Array<{ reference: string }>;
  return rows[0]?.reference ?? null;
}

async function enforceRateLimit(
  request: Request,
  supabaseUrl: string,
  serviceKey: string,
  kind: FormKind,
) {
  const fingerprint = await sha256(`${serviceKey}:${getClientAddress(request)}`);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_form_submission_rate_limit`, {
    method: "POST",
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      p_fingerprint: fingerprint,
      p_kind: kind,
      p_window_seconds: Math.floor(RATE_LIMIT_WINDOW_MS / 1000),
      p_max_submissions: RATE_LIMIT_MAX,
    }),
  });
  if (!response.ok) throw new RequestError(503, "The form service is temporarily unavailable.");

  const claimed = (await response.json()) as boolean;
  if (!claimed) {
    throw new RequestError(429, "Too many submissions. Please wait before trying again.");
  }
}

async function verifyTurnstile(
  request: Request,
  token: string,
  kind: FormKind,
  submissionId: string,
  allowedOrigins: Set<string>,
) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) throw new RequestError(503, "Human verification is not configured.");

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: submissionId,
  });
  const address = getClientAddress(request);
  if (address !== "unknown") body.set("remoteip", address);

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new RequestError(503, "Human verification is temporarily unavailable.");
  }

  if (!response.ok) {
    throw new RequestError(503, "Human verification is temporarily unavailable.");
  }

  let result: {
    success?: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new RequestError(503, "Human verification is temporarily unavailable.");
  }

  const allowedHostnames = new Set(
    Array.from(allowedOrigins, (origin) => {
      try {
        return new URL(origin).hostname;
      } catch {
        return "";
      }
    }).filter(Boolean),
  );

  if (
    !result.success ||
    result.action !== kind ||
    !result.hostname ||
    !allowedHostnames.has(result.hostname)
  ) {
    console.warn("public-form human verification rejected", result["error-codes"] || []);
    throw new RequestError(403, "Human verification failed. Please try again.");
  }
}

function commonFields(payload: JsonRecord) {
  const name = readString(payload, "name", {
    required: true,
    min: 2,
    max: 120,
  }) as string;
  const email = readString(payload, "email", {
    required: true,
    min: 3,
    max: 254,
  }) as string;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError(400, "email is invalid.");
  }

  const phone = readString(payload, "phone", { max: 40 });
  if (phone && !/^[+0-9().\s-]{5,40}$/.test(phone)) {
    throw new RequestError(400, "phone is invalid.");
  }

  return { name, email: email.toLowerCase(), phone };
}

function buildRecord(payload: JsonRecord, kind: FormKind, submissionId: string, reference: string) {
  const common = commonFields(payload);
  const consentAt = new Date().toISOString();

  if (kind === "contact") {
    return {
      submission_id: submissionId,
      reference,
      ...common,
      organisation: readString(payload, "organisation", { max: 160 }),
      subject: requireOption(
        readString(payload, "subject", { required: true, min: 2, max: 120 }),
        contactSubjects,
        "subject",
      ),
      message: readString(payload, "message", {
        required: true,
        min: 10,
        max: 4000,
      }),
      consent_at: consentAt,
    };
  }

  if (kind === "volunteer") {
    if (!common.phone) throw new RequestError(400, "phone is required.");
    return {
      submission_id: submissionId,
      reference,
      ...common,
      phone: common.phone,
      city: readString(payload, "city", { required: true, min: 2, max: 120 }),
      cause: requireOption(
        readString(payload, "cause", { required: true, min: 2, max: 120 }),
        volunteerCauses,
        "cause",
      ),
      availability: requireOption(
        readString(payload, "availability", {
          required: true,
          min: 2,
          max: 40,
        }),
        availabilityOptions,
        "availability",
      ),
      skills: readString(payload, "skills", { max: 600 }),
      area_of_interest: readString(payload, "areaOfInterest", { max: 300 }),
      experience: readString(payload, "experience", { max: 2000 }),
      message: readString(payload, "message", { max: 4000 }),
      communication_preference: requireOption(
        readString(payload, "communicationPreference", {
          required: true,
          min: 2,
          max: 40,
        }),
        communicationOptions,
        "communicationPreference",
      ),
      consent_at: consentAt,
    };
  }

  return {
    submission_id: submissionId,
    reference,
    ...common,
    organisation: readString(payload, "organisation", {
      required: true,
      min: 2,
      max: 160,
    }),
    cause: requireOption(
      readString(payload, "cause", { required: true, min: 2, max: 120 }),
      csrProgrammes,
      "cause",
    ),
    partnership_model: requireOption(
      readString(payload, "partnershipModel", {
        required: true,
        min: 2,
        max: 160,
      }),
      partnershipModels,
      "partnershipModel",
    ),
    outcome_goal: requireOption(
      readString(payload, "outcomeGoal", { required: true, min: 2, max: 160 }),
      outcomeGoals,
      "outcomeGoal",
    ),
    message: readString(payload, "message", { max: 4000 }),
    consent_at: consentAt,
  };
}

async function notifyTeam(kind: FormKind, reference: string) {
  const webhook = Deno.env.get("FORM_NOTIFICATION_WEBHOOK_URL");
  if (!webhook) return;

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "public_form_received", kind, reference }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) console.error("public-form notification failed", response.status);
  } catch {
    console.error("public-form notification failed");
  }
}

function queueNotification(task: Promise<void>) {
  const runtime = (
    globalThis as typeof globalThis & {
      EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
    }
  ).EdgeRuntime;

  if (runtime) runtime.waitUntil(task);
  else void task;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();
  const allowed = Boolean(origin) && allowedOrigins.has(origin);

  if (request.method === "OPTIONS") {
    if (!allowed) return jsonResponse(403, { error: "Origin is not allowed." }, origin, false);
    return new Response(null, {
      status: 204,
      headers: responseHeaders(origin, true),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin, allowed);
  }
  if (!allowed) return jsonResponse(403, { error: "Origin is not allowed." }, origin, false);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { error: "Content-Type must be application/json." }, origin, true);
  }

  const publishableKeys = readPublishableKeys();
  if (!publishableKeys.size) {
    return jsonResponse(503, { error: "The form service is not configured." }, origin, true);
  }
  if (!publishableKeys.has(request.headers.get("apikey") || "")) {
    return jsonResponse(401, { error: "A publishable API key is required." }, origin, true);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = readServiceKey();
  if (!supabaseUrl || !serviceKey || !Deno.env.get("TURNSTILE_SECRET_KEY")) {
    return jsonResponse(503, { error: "The form service is not configured." }, origin, true);
  }

  try {
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > MAX_BODY_BYTES) throw new RequestError(413, "The request is too large.");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      throw new RequestError(413, "The request is too large.");
    }

    let payload: JsonRecord;
    try {
      payload = JSON.parse(rawBody) as JsonRecord;
    } catch {
      throw new RequestError(400, "The request body is not valid JSON.");
    }
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      throw new RequestError(400, "The request body is invalid.");
    }

    const unknownFields = Object.keys(payload).filter((key) => !allowedFields.has(key));
    if (unknownFields.length) throw new RequestError(400, "The request contains unknown fields.");

    const kind = payload.kind;
    if (kind !== "contact" && kind !== "volunteer" && kind !== "csr") {
      throw new RequestError(400, "kind is invalid.");
    }
    const submissionId = readString(payload, "submissionId", {
      required: true,
      min: 36,
      max: 36,
    }) as string;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)
    ) {
      throw new RequestError(400, "submissionId is invalid.");
    }

    const tables: Record<FormKind, string> = {
      contact: "contact_messages",
      volunteer: "volunteer_applications",
      csr: "csr_enquiries",
    };
    const table = tables[kind];

    if (typeof payload.consent !== "boolean" || !payload.consent) {
      throw new RequestError(400, "Consent is required.");
    }
    const website = readString(payload, "website", { max: 300 });
    if (website) {
      return jsonResponse(202, { reference: makeReference(kind) }, origin, true);
    }
    if (typeof payload.startedAt !== "number" || Date.now() - payload.startedAt < 1500) {
      throw new RequestError(429, "Please wait a moment before submitting.");
    }
    const turnstileToken = readString(payload, "turnstileToken", {
      required: true,
      min: 10,
      max: 2048,
    }) as string;

    const reference = makeReference(kind);
    const record = buildRecord(payload, kind, submissionId, reference);
    await enforceRateLimit(request, supabaseUrl, serviceKey, kind);
    await verifyTurnstile(request, turnstileToken, kind, submissionId, allowedOrigins);

    const priorReference = await existingReference(supabaseUrl, serviceKey, table, submissionId);
    if (priorReference) return jsonResponse(200, { reference: priorReference }, origin, true);

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: serviceHeaders(serviceKey, "return=representation"),
      body: JSON.stringify(record),
    });

    if (insertResponse.status === 409) {
      const existing = await existingReference(supabaseUrl, serviceKey, table, submissionId);
      if (existing) return jsonResponse(200, { reference: existing }, origin, true);
    }
    if (!insertResponse.ok) {
      console.error("public-form insert failed", kind, insertResponse.status);
      throw new RequestError(503, "The form service is temporarily unavailable.");
    }

    queueNotification(notifyTeam(kind, reference));
    console.info("public-form stored", kind, reference);
    return jsonResponse(201, { reference }, origin, true);
  } catch (error) {
    if (error instanceof RequestError) {
      return jsonResponse(error.status, { error: error.message }, origin, true);
    }
    console.error("public-form failed");
    return jsonResponse(
      500,
      { error: "We could not send your enquiry. Please try again." },
      origin,
      true,
    );
  }
});
