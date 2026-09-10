-- CreateTable
CREATE TABLE "StaffScheduleSlot" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "half" TEXT NOT NULL,
    "role" TEXT,
    "office" TEXT,
    "providerId" TEXT,

    CONSTRAINT "StaffScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffScheduleSlot_staffId_weekday_half_key" ON "StaffScheduleSlot"("staffId", "weekday", "half");

-- AddForeignKey
ALTER TABLE "StaffScheduleSlot" ADD CONSTRAINT "StaffScheduleSlot_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffScheduleSlot" ADD CONSTRAINT "StaffScheduleSlot_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
