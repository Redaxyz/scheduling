-- AlterTable
ALTER TABLE "Provider" DROP COLUMN "color";

-- AlterTable
ALTER TABLE "ProviderScheduleSlot" ADD COLUMN     "surgery" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProviderAutoOverride" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "half" TEXT NOT NULL,

    CONSTRAINT "ProviderAutoOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAutoOverride_providerId_date_half_key" ON "ProviderAutoOverride"("providerId", "date", "half");

-- AddForeignKey
ALTER TABLE "ProviderAutoOverride" ADD CONSTRAINT "ProviderAutoOverride_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

