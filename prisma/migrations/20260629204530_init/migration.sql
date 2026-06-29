-- AlterTable
ALTER TABLE "feedback" ADD COLUMN     "intent" TEXT,
ADD COLUMN     "keyword" TEXT,
ADD COLUMN     "plan" JSONB;

-- CreateIndex
CREATE INDEX "feedback_type_idx" ON "feedback"("type");

-- CreateIndex
CREATE INDEX "feedback_intent_idx" ON "feedback"("intent");
