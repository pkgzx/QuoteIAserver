/*
  Warnings:

  - You are about to drop the column `TOP` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "TOP",
ADD COLUMN     "otp" INTEGER,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3);
