-- AlterTable
ALTER TABLE "distributions" ADD COLUMN "project_name" TEXT;

-- AlterTable
ALTER TABLE "surveys" ADD COLUMN "show_project_name" BOOLEAN NOT NULL DEFAULT true;
