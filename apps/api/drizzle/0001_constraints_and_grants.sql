-- =============================================================================
-- 0001_constraints_and_grants: database-level guards the ORM can't express.
--
-- 1. CHECK constraints so bad money, ratings or counts can't be stored even if a bug
--    skips validation (defence in depth for CLAUDE.md rule 8).
-- 2. audit_log is append-only for the app role (docs/DATABASE.md "Database roles").
--    The role only exists where scripts/dev/postgres-init.sql or the CDK stack created
--    it, so the REVOKE is conditional (CI test databases have no app role).
--
-- Rollback: ALTER TABLE … DROP CONSTRAINT <name> for each CHECK below, and
--   GRANT UPDATE, DELETE ON audit_log TO thaala_app (only if truly needed).
-- =============================================================================
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_members_positive" CHECK ("members_count" > 0);--> statement-breakpoint
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_rating_range" CHECK ("rating_avg" >= 0 AND "rating_avg" <= 5);--> statement-breakpoint
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_price_nonneg" CHECK ("price_from_cents" >= 0);--> statement-breakpoint
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_districts_nonempty" CHECK (cardinality("districts") > 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_price_nonneg" CHECK ("price_from_cents" >= 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_duration_positive" CHECK ("duration_min" > 0 AND "members" > 0);--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_budget_order" CHECK ("budget_max_cents" IS NULL OR "budget_max_cents" >= "budget_min_cents");--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_styles_nonempty" CHECK (cardinality("music_styles") > 0 AND cardinality("languages") > 0);--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_notes_length" CHECK ("notes" IS NULL OR char_length("notes") <= 1000);--> statement-breakpoint
ALTER TABLE "enquiry_matches" ADD CONSTRAINT "enquiry_matches_score_range" CHECK ("score" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_price_positive" CHECK ("price_cents" > 0);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_counts_positive" CHECK ("duration_min" > 0 AND "members" > 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amounts" CHECK ("total_cents" > 0 AND "deposit_cents" >= 0 AND "deposit_cents" <= "total_cents");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'thaala_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM thaala_app;
  END IF;
END
$$;
