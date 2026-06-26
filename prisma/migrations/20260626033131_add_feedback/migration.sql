-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageIdx" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "context" TEXT,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_sessionId_idx" ON "feedback"("sessionId");
