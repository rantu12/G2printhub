ALTER TABLE "CustomerArtwork"
    ALTER COLUMN "fileName" DROP NOT NULL,
    ALTER COLUMN "contentType" DROP NOT NULL,
    ALTER COLUMN "fileSize" DROP NOT NULL,
    ALTER COLUMN "storageKey" DROP NOT NULL;

ALTER TABLE "CustomerArtwork"
    ADD COLUMN "customText" TEXT,
    ADD COLUMN "printPasswordEncrypted" TEXT,
    ADD COLUMN "pdfPasswordEncrypted" TEXT;
