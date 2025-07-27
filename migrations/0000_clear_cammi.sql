CREATE TABLE "analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"campaign_id" varchar,
	"date" timestamp NOT NULL,
	"metric" varchar NOT NULL,
	"value" integer NOT NULL,
	"channel" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_prospects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"prospect_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"personalized_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"replied_at" timestamp,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"subject" varchar,
	"message_template" text,
	"goal" varchar,
	"tone" varchar,
	"total_prospects" integer DEFAULT 0,
	"sent" integer DEFAULT 0,
	"delivered" integer DEFAULT 0,
	"opened" integer DEFAULT 0,
	"clicked" integer DEFAULT 0,
	"replied" integer DEFAULT 0,
	"converted" integer DEFAULT 0,
	"scheduled" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discovered_prospects" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_id" integer,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"company" varchar(255),
	"title" varchar(255),
	"industry" varchar(100),
	"location" varchar(255),
	"phone" varchar(50),
	"linkedin_url" varchar(500),
	"ai_score" numeric(5, 2),
	"confidence_score" numeric(5, 2),
	"data_sources" text[],
	"intent_signals" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"prospect_id" varchar NOT NULL,
	"campaign_id" varchar,
	"type" varchar NOT NULL,
	"subject" varchar,
	"content" text NOT NULL,
	"tone" varchar,
	"ai_generated" boolean DEFAULT false,
	"variant" varchar,
	"confidence_score" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospect_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"search_query" jsonb NOT NULL,
	"results_count" integer NOT NULL,
	"ai_insights" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"company" varchar,
	"title" varchar,
	"industry" varchar,
	"location" varchar,
	"linkedin_url" varchar,
	"website_url" varchar,
	"score" integer DEFAULT 0,
	"verified" boolean DEFAULT false,
	"data_source" varchar,
	"data_quality" integer DEFAULT 0,
	"notes" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar,
	"password" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_prospects" ADD CONSTRAINT "discovered_prospects_search_id_prospect_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."prospect_searches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_searches" ADD CONSTRAINT "prospect_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");