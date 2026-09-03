-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "dedicatedAidForProviderId" TEXT;

-- CreateTable
CREATE TABLE "ScribeFallback" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "half" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "conditionalProviderId" TEXT,
    "conditionalRequireActive" BOOLEAN,

    CONSTRAINT "ScribeFallback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_dedicatedAidForProviderId_fkey" FOREIGN KEY ("dedicatedAidForProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScribeFallback" ADD CONSTRAINT "ScribeFallback_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScribeFallback" ADD CONSTRAINT "ScribeFallback_conditionalProviderId_fkey" FOREIGN KEY ("conditionalProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
