/*
  Warnings:

  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add with temporary default for existing rows, then drop default
ALTER TABLE "users" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ALTER COLUMN "name" DROP DEFAULT;
