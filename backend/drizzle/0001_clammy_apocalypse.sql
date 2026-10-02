ALTER TABLE "users" ADD COLUMN "passwordHash" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "age";