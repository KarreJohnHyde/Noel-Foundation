import Stripe from "npm:stripe@22.4.0";

type JsonRecord = Record<string, unknown>;

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

function serviceHeaders(serviceKey: string, prefer = "") {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
  };
  if (serviceKey.split(".").length === 3) headers.Authorization = `Bearer ${serviceKey}`;
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function database(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serviceHeaders(serviceKey),
      ...(init.headers || {}),
    },
  });
  return response;
}

function makeReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const random = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `NF-D-${date}-${random}`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const signingSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = readServiceKey();
  if (!stripeKey || !signingSecret || !supabaseUrl || !serviceKey) {
    return new Response("Webhook is not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature") || "";
  const body = await request.text();
  const stripe = new Stripe(stripeKey);
  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      signingSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const prior = await database(
    supabaseUrl,
    serviceKey,
    `stripe_webhook_events?select=event_id&event_id=eq.${encodeURIComponent(event.id)}&limit=1`,
  );
  if (!prior.ok) return new Response("Database unavailable", { status: 503 });
  const priorRows = (await prior.json()) as Array<{ event_id: string }>;
  if (priorRows.length) return Response.json({ received: true, duplicate: true });

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as any;
      const paid = session.payment_status === "paid" || session.mode === "subscription";
      const update = await database(
        supabaseUrl,
        serviceKey,
        `donations?stripe_checkout_session_id=eq.${encodeURIComponent(session.id)}`,
        {
          method: "PATCH",
          headers: serviceHeaders(serviceKey, "return=minimal"),
          body: JSON.stringify({
            status: paid ? "confirmed" : "pending",
            paid_at: paid ? new Date().toISOString() : null,
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            stripe_subscription_id:
              typeof session.subscription === "string" ? session.subscription : null,
          }),
        },
      );
      if (!update.ok) throw new Error("checkout update failed");
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as any;
      const update = await database(
        supabaseUrl,
        serviceKey,
        `donations?stripe_checkout_session_id=eq.${encodeURIComponent(session.id)}`,
        {
          method: "PATCH",
          headers: serviceHeaders(serviceKey, "return=minimal"),
          body: JSON.stringify({ status: "failed" }),
        },
      );
      if (!update.ok) throw new Error("failed checkout update failed");
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as any;
      const update = await database(
        supabaseUrl,
        serviceKey,
        `donations?stripe_checkout_session_id=eq.${encodeURIComponent(session.id)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: serviceHeaders(serviceKey, "return=minimal"),
          body: JSON.stringify({ status: "cancelled" }),
        },
      );
      if (!update.ok) throw new Error("expired checkout update failed");
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as any;
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;
      const reference =
        invoice.parent?.subscription_details?.metadata?.donation_reference ||
        invoice.subscription_details?.metadata?.donation_reference ||
        null;
      const invoicePaymentIntent =
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : typeof invoice.confirmation_secret?.payment_intent === "string"
            ? invoice.confirmation_secret.payment_intent
            : null;
      const filter = subscriptionId
        ? `stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}`
        : reference
          ? `reference=eq.${encodeURIComponent(reference)}`
          : "id=eq.-1";
      const lookup = await database(
        supabaseUrl,
        serviceKey,
        `donations?select=donor_id,designation,reference,stripe_invoice_id&${filter}&order=created_at.asc&limit=1`,
      );
      if (!lookup.ok) throw new Error("subscription lookup failed");
      const rows = (await lookup.json()) as Array<{
        donor_id: number;
        designation: string | null;
        reference: string;
        stripe_invoice_id: string | null;
      }>;
      const base = rows[0];
      if (base) {
        const invoiceExists = await database(
          supabaseUrl,
          serviceKey,
          `donations?select=id&stripe_invoice_id=eq.${encodeURIComponent(invoice.id)}&limit=1`,
        );
        if (!invoiceExists.ok) throw new Error("invoice lookup failed");
        const existingInvoices = (await invoiceExists.json()) as Array<{ id: number }>;
        if (!existingInvoices.length) {
          const initialInvoice = !base.stripe_invoice_id;
          const path = initialInvoice
            ? `donations?reference=eq.${encodeURIComponent(base.reference)}`
            : "donations";
          const method = initialInvoice ? "PATCH" : "POST";
          const record = {
            ...(initialInvoice
              ? {}
              : {
                  reference: makeReference(),
                  donor_id: base.donor_id,
                  amount: Number(invoice.amount_paid || 0) / 100,
                  currency: String(invoice.currency || "inr").toUpperCase(),
                  designation: base.designation,
                  frequency: "monthly",
                  payment_provider: "stripe",
                }),
            status: "confirmed",
            paid_at: new Date(
              (invoice.status_transitions?.paid_at || event.created) * 1000,
            ).toISOString(),
            stripe_subscription_id: subscriptionId,
            stripe_invoice_id: invoice.id,
            stripe_payment_intent_id: invoicePaymentIntent,
          };
          const write = await database(supabaseUrl, serviceKey, path, {
            method,
            headers: serviceHeaders(serviceKey, "return=minimal"),
            body: JSON.stringify(record),
          });
          if (!write.ok) throw new Error("invoice reconciliation failed");
        }
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as any;
      const reconciliationFilter =
        typeof charge.payment_intent === "string"
          ? `stripe_payment_intent_id=eq.${encodeURIComponent(charge.payment_intent)}`
          : typeof charge.invoice === "string"
            ? `stripe_invoice_id=eq.${encodeURIComponent(charge.invoice)}`
            : null;
      if (reconciliationFilter) {
        const update = await database(
          supabaseUrl,
          serviceKey,
          `donations?${reconciliationFilter}`,
          {
            method: "PATCH",
            headers: serviceHeaders(serviceKey, "return=minimal"),
            body: JSON.stringify({ status: charge.refunded ? "refunded" : "confirmed" }),
          },
        );
        if (!update.ok) throw new Error("refund reconciliation failed");
      }
    }

    const logged = await database(supabaseUrl, serviceKey, "stripe_webhook_events", {
      method: "POST",
      headers: serviceHeaders(serviceKey, "resolution=ignore-duplicates,return=minimal"),
      body: JSON.stringify({
        event_id: event.id,
        event_type: event.type,
        livemode: Boolean(event.livemode),
      }),
    });
    if (!logged.ok) throw new Error("event logging failed");
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      "stripe webhook processing failed",
      event.id,
      error instanceof Error ? error.message : "unknown",
    );
    return new Response("Webhook processing failed", { status: 500 });
  }
});
