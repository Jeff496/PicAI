/**
 * Test script to validate the face collection schema works correctly
 * Run with: npx tsx scripts/test-face-schema.ts
 */

import prisma from '../src/prisma/client.js';

async function testFaceSchema() {
  console.log('🧪 Testing Face Collection Schema...\n');

  try {
    // 1. Get an existing user (required for testing)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('❌ No users in database. Please create a user first.');
      process.exit(1);
    }
    console.log(`✓ Found user: ${user.email}`);

    // 2. Create a FaceCollection for the user
    const faceCollection = await prisma.faceCollection.create({
      data: {
        userId: user.id,
        awsCollectionId: `test-user-collection-${Date.now()}`,
      },
    });
    console.log(`✓ Created FaceCollection: ${faceCollection.id}`);

    // 3. Create a Person in the collection
    const person = await prisma.person.create({
      data: {
        name: 'Test Person',
        collectionId: faceCollection.id,
      },
    });
    console.log(`✓ Created Person: ${person.id} (${person.name})`);

    // 4. Get an existing photo (if any) to attach a face
    const photo = await prisma.photo.findFirst({
      where: { userId: user.id },
    });

    if (photo) {
      // 5. Create a Face detected in the photo
      const face = await prisma.face.create({
        data: {
          photoId: photo.id,
          personId: person.id,
          boundingBox: { left: 0.1, top: 0.2, width: 0.3, height: 0.4 },
          confidence: 99.5,
          indexed: false,
        },
      });
      console.log(`✓ Created Face: ${face.id} (confidence: ${face.confidence}%)`);

      // 6. Test the relation - fetch face with person and photo
      const faceWithRelations = await prisma.face.findUnique({
        where: { id: face.id },
        include: {
          person: true,
          photo: { select: { id: true, filename: true } },
        },
      });
      console.log(`✓ Face relations work: person=${faceWithRelations?.person?.name}, photo=${faceWithRelations?.photo?.filename}`);

      // 7. Test Photo → faces relation
      const photoWithFaces = await prisma.photo.findUnique({
        where: { id: photo.id },
        include: { faces: true },
      });
      console.log(`✓ Photo has ${photoWithFaces?.faces.length} face(s)`);

      // Clean up face
      await prisma.face.delete({ where: { id: face.id } });
      console.log('✓ Deleted test Face');
    } else {
      console.log('⚠ No photos found - skipping Face creation test');
    }

    // 8. Test User → faceCollection relation
    const userWithCollection = await prisma.user.findUnique({
      where: { id: user.id },
      include: { faceCollection: true },
    });
    console.log(`✓ User.faceCollection relation works: ${userWithCollection?.faceCollection?.id}`);

    // 9. Test Person → faces relation
    const personWithFaces = await prisma.person.findUnique({
      where: { id: person.id },
      include: { faces: true },
    });
    console.log(`✓ Person.faces relation works: ${personWithFaces?.faces.length} faces`);

    // 10. Test Album face tagging (if album exists)
    const album = await prisma.album.findFirst({
      where: { userId: user.id },
    });

    if (album) {
      // Update album to enable face tagging
      const updatedAlbum = await prisma.album.update({
        where: { id: album.id },
        data: { allowFaceTagging: true },
      });
      console.log(`✓ Album.allowFaceTagging field works: ${updatedAlbum.allowFaceTagging}`);

      // Create AlbumFaceCollection
      const albumCollection = await prisma.albumFaceCollection.create({
        data: {
          albumId: album.id,
          awsCollectionId: `test-album-collection-${Date.now()}`,
        },
      });
      console.log(`✓ Created AlbumFaceCollection: ${albumCollection.id}`);

      // Test Album → faceCollection relation
      const albumWithCollection = await prisma.album.findUnique({
        where: { id: album.id },
        include: { faceCollection: true },
      });
      console.log(`✓ Album.faceCollection relation works: ${albumWithCollection?.faceCollection?.id}`);

      // Clean up album collection
      await prisma.albumFaceCollection.delete({ where: { id: albumCollection.id } });
      console.log('✓ Deleted test AlbumFaceCollection');

      // Reset album
      await prisma.album.update({
        where: { id: album.id },
        data: { allowFaceTagging: false },
      });
    } else {
      console.log('⚠ No albums found - skipping AlbumFaceCollection test');
    }

    // Clean up
    await prisma.person.delete({ where: { id: person.id } });
    console.log('✓ Deleted test Person');

    await prisma.faceCollection.delete({ where: { id: faceCollection.id } });
    console.log('✓ Deleted test FaceCollection');

    console.log('\n✅ All schema tests passed! Face collection models are working correctly.');
  } catch (error) {
    console.error('\n❌ Schema test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testFaceSchema();
