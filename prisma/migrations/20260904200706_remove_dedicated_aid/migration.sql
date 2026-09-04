-- Remove the "dedicated aid" concept (Staff.dedicatedAidForProviderId).
-- Aid was a per-provider role layered on top of Rooming; it's being folded
-- back into plain Rooming/Support, which any non-x-ray staff can already do.

-- Drop the now-unused SUB_SCRIBE role's assignment rows (stale, pre-dates
-- this change, and the role no longer exists in the app).
DELETE FROM "Assignment" WHERE "role" = 'SUB_SCRIBE';

-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT IF EXISTS "Staff_dedicatedAidForProviderId_fkey";

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "dedicatedAidForProviderId";
