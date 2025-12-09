-- AlterTable
ALTER TABLE "albums" ADD COLUMN     "allow_face_tagging" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "face_collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "aws_collection_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_face_collections" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "aws_collection_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_face_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "collection_id" TEXT,
    "album_collection_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faces" (
    "id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "person_id" TEXT,
    "aws_face_id" TEXT,
    "bounding_box" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indexed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "face_collections_user_id_key" ON "face_collections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "face_collections_aws_collection_id_key" ON "face_collections"("aws_collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_face_collections_album_id_key" ON "album_face_collections"("album_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_face_collections_aws_collection_id_key" ON "album_face_collections"("aws_collection_id");

-- CreateIndex
CREATE INDEX "persons_collection_id_idx" ON "persons"("collection_id");

-- CreateIndex
CREATE INDEX "persons_album_collection_id_idx" ON "persons"("album_collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "faces_aws_face_id_key" ON "faces"("aws_face_id");

-- CreateIndex
CREATE INDEX "faces_photo_id_idx" ON "faces"("photo_id");

-- CreateIndex
CREATE INDEX "faces_person_id_idx" ON "faces"("person_id");

-- CreateIndex
CREATE INDEX "faces_aws_face_id_idx" ON "faces"("aws_face_id");

-- AddForeignKey
ALTER TABLE "face_collections" ADD CONSTRAINT "face_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_face_collections" ADD CONSTRAINT "album_face_collections_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "face_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_album_collection_id_fkey" FOREIGN KEY ("album_collection_id") REFERENCES "album_face_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faces" ADD CONSTRAINT "faces_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faces" ADD CONSTRAINT "faces_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
