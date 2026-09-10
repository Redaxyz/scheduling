-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,
    "positionOffice" TEXT NOT NULL,
    "positionRole" TEXT NOT NULL,
    "positionProviderId" TEXT,
    "positionStaffId" TEXT NOT NULL,
    "requestedByStaffId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwapRequest_date_half_status_idx" ON "SwapRequest"("date", "half", "status");

-- CreateIndex
CREATE INDEX "SwapRequest_positionStaffId_status_idx" ON "SwapRequest"("positionStaffId", "status");

-- CreateIndex
CREATE INDEX "SwapRequest_requestedByStaffId_status_idx" ON "SwapRequest"("requestedByStaffId", "status");

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_positionStaffId_fkey" FOREIGN KEY ("positionStaffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requestedByStaffId_fkey" FOREIGN KEY ("requestedByStaffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
