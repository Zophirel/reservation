CREATE TABLE "CalendarSyncState" (
    "id" TEXT NOT NULL DEFAULT 'google',
    "calendarId" TEXT NOT NULL,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSyncState_pkey" PRIMARY KEY ("id")
);
