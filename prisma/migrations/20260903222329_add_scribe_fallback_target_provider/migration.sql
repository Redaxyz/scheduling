-- AlterTable
ALTER TABLE "ScribeFallback" ADD COLUMN     "targetProviderId" TEXT;

-- AddForeignKey
ALTER TABLE "ScribeFallback" ADD CONSTRAINT "ScribeFallback_targetProviderId_fkey" FOREIGN KEY ("targetProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
