CREATE TYPE "public"."location_kind" AS ENUM('institute', 'hall', 'home', 'online');--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "grade_levels_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "grade_levels_name_len" CHECK (char_length(btrim("grade_levels"."name")) between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "grade_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "location_kind" NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "locations_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "locations_name_len" CHECK (char_length(btrim("locations"."name")) between 1 and 80),
	CONSTRAINT "locations_address_len" CHECK ("locations"."address" is null or char_length("locations"."address") <= 300)
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "subjects_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "subjects_name_len" CHECK (char_length(btrim("subjects"."name")) between 1 and 80),
	CONSTRAINT "subjects_code_len" CHECK ("subjects"."code" is null or char_length("subjects"."code") <= 20)
);
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grade_levels" ADD CONSTRAINT "grade_levels_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grade_levels_org_name_active_key" ON "grade_levels" USING btree ("org_id",lower("name")) WHERE "grade_levels"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_org_name_active_key" ON "locations" USING btree ("org_id",lower("name")) WHERE "locations"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_org_name_active_key" ON "subjects" USING btree ("org_id",lower("name")) WHERE "subjects"."archived_at" is null;