-- Walk back the day-off approval feature: StaffAbsence rows are always
-- effective immediately again, so the status column is no longer needed.
ALTER TABLE "StaffAbsence" DROP COLUMN "status";
