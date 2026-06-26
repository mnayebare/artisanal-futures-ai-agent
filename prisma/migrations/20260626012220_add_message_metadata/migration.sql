/*
  Warnings:

  - You are about to drop the column `material` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "metadata" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "products" DROP COLUMN "material";
