-- CreateTable
CREATE TABLE "DayNote" (
    "date" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayNote_pkey" PRIMARY KEY ("date")
);
