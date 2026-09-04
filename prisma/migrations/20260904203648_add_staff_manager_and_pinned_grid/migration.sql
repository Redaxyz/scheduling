-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "isManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedGridIndex" INTEGER;
