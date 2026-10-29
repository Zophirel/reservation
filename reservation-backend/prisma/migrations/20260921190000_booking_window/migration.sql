CREATE TYPE "BookingWindow" AS ENUM ('WEEK', 'MONTH');
ALTER TABLE "BusinessSettings" ADD COLUMN "bookingWindow" "BookingWindow" NOT NULL DEFAULT 'MONTH';
ALTER TABLE "BusinessSettings" DROP COLUMN "bookingFromDate";
ALTER TABLE "BusinessSettings" DROP COLUMN "bookingToDate";