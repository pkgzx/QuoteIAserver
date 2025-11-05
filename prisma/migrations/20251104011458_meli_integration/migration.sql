-- AlterTable
ALTER TABLE "RequestShopping" ADD COLUMN     "meliProductCurrency" TEXT,
ADD COLUMN     "meliProductId" TEXT,
ADD COLUMN     "meliProductLink" TEXT,
ADD COLUMN     "meliProductName" TEXT,
ADD COLUMN     "meliProductPrice" DOUBLE PRECISION,
ADD COLUMN     "meliSearchResults" JSONB,
ADD COLUMN     "priceUSD" DOUBLE PRECISION,
ADD COLUMN     "quotationPdfPath" TEXT;
