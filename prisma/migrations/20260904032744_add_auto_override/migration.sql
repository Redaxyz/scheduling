-- CreateTable
CREATE TABLE "AutoOverride" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,

    CONSTRAINT "AutoOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoOverride_staffId_date_half_key" ON "AutoOverride"("staffId", "date", "half");

-- AddForeignKey
ALTER TABLE "AutoOverride" ADD CONSTRAINT "AutoOverride_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
