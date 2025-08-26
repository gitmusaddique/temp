CREATE TABLE "attendance_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"attendance_data" text NOT NULL,
	"total_on_duty" integer DEFAULT 0 NOT NULL,
	"ot_days" integer DEFAULT 0 NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"designation" text,
	"department" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"serial_number" integer NOT NULL,
	CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id")
);
