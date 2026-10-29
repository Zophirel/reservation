CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "InvitationType" AS ENUM ('ONE_TIME', 'PERMANENT');
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "ExceptionType" AS ENUM ('DAY_OFF', 'SPECIAL_HOURS');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "phoneNumber" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "Invitation" (
  "id" TEXT PRIMARY KEY,
  "type" "InvitationType" NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "phoneNumber" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "description" TEXT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "tokenEncrypted" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ,
  "usedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "Service" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "WeeklyAvailability" (
  "id" TEXT PRIMARY KEY,
  "weekday" INTEGER NOT NULL UNIQUE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "intervals" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "AvailabilityException" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "type" "ExceptionType" NOT NULL,
  "reason" TEXT,
  "intervals" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "Reservation" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "serviceId" TEXT NOT NULL REFERENCES "Service"("id") ON DELETE RESTRICT,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
  "cancelledAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "BusinessSettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "businessName" TEXT NOT NULL DEFAULT 'Reservio',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
  "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX "Reservation_startAt_endAt_idx" ON "Reservation"("startAt", "endAt");
CREATE INDEX "Reservation_userId_startAt_idx" ON "Reservation"("userId", "startAt");
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_confirmed_overlap"
  EXCLUDE USING gist (tstzrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');
