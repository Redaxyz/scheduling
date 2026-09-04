-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "defaultXrayOffice" TEXT;

-- CreateTable
CREATE TABLE "XrayBackup" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "primaryStaffId" TEXT NOT NULL,

    CONSTRAINT "XrayBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XrayBackup_staffId_primaryStaffId_key" ON "XrayBackup"("staffId", "primaryStaffId");

-- AddForeignKey
ALTER TABLE "XrayBackup" ADD CONSTRAINT "XrayBackup_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayBackup" ADD CONSTRAINT "XrayBackup_primaryStaffId_fkey" FOREIGN KEY ("primaryStaffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
