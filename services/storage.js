const { bucket } = require('./firebaseAdmin');
const { v4: uuidv4 } = require('uuid');

async function uploadImageToFirebase(fileBuffer, destinationPath, contentType) {
  const file = bucket.file(destinationPath);
  const token = uuidv4();
  const metadata = {
    metadata: {
      firebaseStorageDownloadTokens: token,
    },
    contentType: contentType || 'application/octet-stream',
    cacheControl: 'public, max-age=31536000',
  };
  await file.save(fileBuffer, { resumable: false, metadata });
  const encodedPath = encodeURIComponent(destinationPath);
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
  return publicUrl;
}

async function uploadToFolder(file, folder) {
  const ext = String(file.originalname || '').split('.').pop() || 'bin';
  const rand = Math.random().toString(36).slice(2);
  const fileName = `${Date.now()}-${rand}.${ext}`;
  const filePath = `${folder}/${fileName}`;
  const url = await uploadImageToFirebase(file.buffer, filePath, file.mimetype);
  return url;
}

module.exports = {
  uploadImageToFirebase,
  uploadToFolder,
};
