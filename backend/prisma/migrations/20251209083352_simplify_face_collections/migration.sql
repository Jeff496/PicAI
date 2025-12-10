/*
  Warnings:

  - You are about to drop the column `allow_face_tagging` on the `albums` table. All the data in the column will be lost.
  - You are about to drop the column `album_collection_id` on the `persons` table. All the data in the column will be lost.
  - You are about to drop the `album_face_collections` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `collection_id` on table `persons` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "album_face_collections" DROP CONSTRAINT "album_face_collections_album_id_fkey";

-- DropForeignKey
ALTER TABLE "persons" DROP CONSTRAINT "persons_album_collection_id_fkey";

-- DropIndex
DROP INDEX "persons_album_collection_id_idx";

-- AlterTable
ALTER TABLE "albums" DROP COLUMN "allow_face_tagging";

-- AlterTable
ALTER TABLE "persons" DROP COLUMN "album_collection_id",
ALTER COLUMN "collection_id" SET NOT NULL;

-- DropTable
DROP TABLE "album_face_collections";
