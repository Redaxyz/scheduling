-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderScheduleSlot" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "half" TEXT NOT NULL,
    "office" TEXT,

    CONSTRAINT "ProviderScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAbsence" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "canScribe" BOOLEAN NOT NULL DEFAULT false,
    "homeOffice" TEXT,
    "dedicatedProviderId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAbsence" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCount" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_initials_key" ON "Provider"("initials");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderScheduleSlot_providerId_weekday_half_key" ON "ProviderScheduleSlot"("providerId", "weekday", "half");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAbsence_providerId_date_half_key" ON "ProviderAbsence"("providerId", "date", "half");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAbsence_staffId_date_half_key" ON "StaffAbsence"("staffId", "date", "half");

-- CreateIndex
CREATE UNIQUE INDEX "PatientCount_providerId_date_half_key" ON "PatientCount"("providerId", "date", "half");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_staffId_date_half_key" ON "Assignment"("staffId", "date", "half");

-- AddForeignKey
ALTER TABLE "ProviderScheduleSlot" ADD CONSTRAINT "ProviderScheduleSlot_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAbsence" ADD CONSTRAINT "ProviderAbsence_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_dedicatedProviderId_fkey" FOREIGN KEY ("dedicatedProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAbsence" ADD CONSTRAINT "StaffAbsence_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCount" ADD CONSTRAINT "PatientCount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
