import type { Express } from "express";
import { type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { LIMITS, isPro } from "../lib/entitlements";

const upsertProfileBody = z.object({
  id: z.string().min(1),
  email: z.string().email(),
});

const checkoutBody = z.object({
  userId: z.string().min(1),
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const portalBody = z.object({
  userId: z.string().min(1),
  returnUrl: z.string().url(),
});

const createRulesetBody = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(100),
  configJson: z.string().min(2),
});

const updateRulesetBody = z.object({
  name: z.string().min(1).max(100).optional(),
  configJson: z.string().min(2).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/profile/upsert", async (req, res) => {
    try {
      const parsed = upsertProfileBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten().fieldErrors });
      }
      const { id, email } = parsed.data;
      const profile = await storage.upsertProfile({
        id,
        email,
        plan: "free",
        subscriptionStatus: "inactive",
      });
      return res.json(profile);
    } catch (err: any) {
      console.error("Profile upsert error:", err);
      return res.status(500).json({ message: "Failed to upsert profile" });
    }
  });

  app.get("/api/profile/:id", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      return res.json(profile);
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      return res.json({ publishableKey: key });
    } catch (err: any) {
      console.error("Stripe key error:", err);
      return res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });

  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const parsed = checkoutBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten().fieldErrors });
      }

      const { userId, priceId, successUrl, cancelUrl } = parsed.data;
      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const stripe = await getUncachableStripeClient();

      let customerId = profile.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: profile.email,
          metadata: { userId },
        });
        await storage.updateProfileStripe(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
      return res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/portal", async (req, res) => {
    try {
      const parsed = portalBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten().fieldErrors });
      }

      const { userId, returnUrl } = parsed.data;
      const profile = await storage.getProfile(userId);
      if (!profile?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripeCustomerId,
        return_url: returnUrl,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Portal error:", err);
      return res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  app.post("/api/stripe/subscription-webhook", async (req, res) => {
    try {
      const { customerId, subscriptionId, status, currentPeriodEnd, plan } = req.body;
      if (!customerId) {
        return res.status(400).json({ message: "customerId required" });
      }

      const profile = await storage.getProfileByStripeCustomerId(customerId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found for customer" });
      }

      await storage.updateProfileStripe(profile.id, {
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: status || "inactive",
        plan: plan || (status === "active" || status === "trialing" ? "pro" : profile.plan),
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      });

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Subscription webhook error:", err);
      return res.status(500).json({ message: "Failed to process subscription update" });
    }
  });

  app.get("/api/rulesets/:userId", async (req, res) => {
    try {
      const rulesets = await storage.getRulesets(req.params.userId);
      return res.json(rulesets);
    } catch (err: any) {
      console.error("Rulesets fetch error:", err);
      return res.status(500).json({ message: "Failed to fetch rulesets" });
    }
  });

  app.post("/api/rulesets", async (req, res) => {
    try {
      const parsed = createRulesetBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten().fieldErrors });
      }

      const { userId, name, configJson } = parsed.data;

      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const count = await storage.countRulesets(userId);
      const maxRulesets = isPro(profile) ? LIMITS.pro.maxRulesets : LIMITS.free.maxRulesets;
      if (count >= maxRulesets) {
        return res.status(403).json({
          message: `Ruleset limit reached (${maxRulesets}). Upgrade to Pro for more.`,
          code: "RULESET_LIMIT",
        });
      }

      const ruleset = await storage.createRuleset({ userId, name, configJson });
      return res.status(201).json(ruleset);
    } catch (err: any) {
      console.error("Ruleset create error:", err);
      return res.status(500).json({ message: "Failed to create ruleset" });
    }
  });

  app.patch("/api/rulesets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

      const parsed = updateRulesetBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten().fieldErrors });
      }

      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ message: "userId query param required" });

      const ruleset = await storage.updateRuleset(id, userId, parsed.data);
      if (!ruleset) return res.status(404).json({ message: "Ruleset not found" });

      return res.json(ruleset);
    } catch (err: any) {
      console.error("Ruleset update error:", err);
      return res.status(500).json({ message: "Failed to update ruleset" });
    }
  });

  app.delete("/api/rulesets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ message: "userId query param required" });

      const deleted = await storage.deleteRuleset(id, userId);
      if (!deleted) return res.status(404).json({ message: "Ruleset not found" });

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Ruleset delete error:", err);
      return res.status(500).json({ message: "Failed to delete ruleset" });
    }
  });

  return httpServer;
}
