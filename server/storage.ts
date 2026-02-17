import { type Profile, type InsertProfile, type Ruleset, type InsertRuleset, profiles, rulesets } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  upsertProfile(profile: InsertProfile): Promise<Profile>;
  updateProfileStripe(id: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: Date | null;
  }): Promise<Profile | undefined>;
  getProfileByStripeCustomerId(customerId: string): Promise<Profile | undefined>;

  getRulesets(userId: string): Promise<Ruleset[]>;
  getRuleset(id: number, userId: string): Promise<Ruleset | undefined>;
  createRuleset(ruleset: InsertRuleset): Promise<Ruleset>;
  updateRuleset(id: number, userId: string, data: { name?: string; configJson?: string }): Promise<Ruleset | undefined>;
  deleteRuleset(id: number, userId: string): Promise<boolean>;
  countRulesets(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(id: string): Promise<Profile | undefined> {
    const [row] = await db.select().from(profiles).where(eq(profiles.id, id));
    return row;
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const [row] = await db.select().from(profiles).where(eq(profiles.email, email));
    return row;
  }

  async upsertProfile(profile: InsertProfile): Promise<Profile> {
    const [row] = await db
      .insert(profiles)
      .values(profile)
      .onConflictDoUpdate({
        target: profiles.id,
        set: { email: profile.email },
      })
      .returning();
    return row;
  }

  async updateProfileStripe(id: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: Date | null;
  }): Promise<Profile | undefined> {
    const setData: Record<string, any> = {};
    if (data.stripeCustomerId !== undefined) setData.stripeCustomerId = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined) setData.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.plan !== undefined) setData.plan = data.plan;
    if (data.subscriptionStatus !== undefined) setData.subscriptionStatus = data.subscriptionStatus;
    if (data.currentPeriodEnd !== undefined) setData.currentPeriodEnd = data.currentPeriodEnd;

    if (Object.keys(setData).length === 0) return this.getProfile(id);

    const [row] = await db.update(profiles).set(setData).where(eq(profiles.id, id)).returning();
    return row;
  }

  async getProfileByStripeCustomerId(customerId: string): Promise<Profile | undefined> {
    const [row] = await db.select().from(profiles).where(eq(profiles.stripeCustomerId, customerId));
    return row;
  }

  async getRulesets(userId: string): Promise<Ruleset[]> {
    return db.select().from(rulesets).where(eq(rulesets.userId, userId));
  }

  async getRuleset(id: number, userId: string): Promise<Ruleset | undefined> {
    const [row] = await db.select().from(rulesets).where(and(eq(rulesets.id, id), eq(rulesets.userId, userId)));
    return row;
  }

  async createRuleset(ruleset: InsertRuleset): Promise<Ruleset> {
    const [row] = await db.insert(rulesets).values(ruleset).returning();
    return row;
  }

  async updateRuleset(id: number, userId: string, data: { name?: string; configJson?: string }): Promise<Ruleset | undefined> {
    const setData: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) setData.name = data.name;
    if (data.configJson !== undefined) setData.configJson = data.configJson;

    const [row] = await db.update(rulesets).set(setData)
      .where(and(eq(rulesets.id, id), eq(rulesets.userId, userId)))
      .returning();
    return row;
  }

  async deleteRuleset(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(rulesets)
      .where(and(eq(rulesets.id, id), eq(rulesets.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async countRulesets(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(rulesets).where(eq(rulesets.userId, userId));
    return result[0]?.count ?? 0;
  }
}

export const storage = new DatabaseStorage();
