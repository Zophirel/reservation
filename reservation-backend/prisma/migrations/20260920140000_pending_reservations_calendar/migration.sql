ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_no_confirmed_overlap";

CREATE TYPE "ReservationStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation"
  ALTER COLUMN "status" TYPE "ReservationStatus_new"
  USING ("status"::text::"ReservationStatus_new");

DROP TYPE "ReservationStatus";
ALTER TYPE "ReservationStatus_new" RENAME TO "ReservationStatus";
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE TYPE "CalendarSyncStatus" AS ENUM ('NOT_ATTEMPTED', 'SYNCED', 'FAILED', 'DELETED', 'NOT_CONFIGURED');

ALTER TABLE "Reservation"
  ADD COLUMN "calendarEventId" TEXT,
  ADD COLUMN "calendarSyncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
  ADD COLUMN "calendarSyncError" TEXT,
  ADD COLUMN "calendarSyncedAt" TIMESTAMPTZ;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_active_overlap"
  EXCLUDE USING gist (tstzrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
