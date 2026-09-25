const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

let client = null;

async function getMongoClient() {
  if (!client && MONGODB_URI) {
    const uri = MONGODB_URI.includes('?')
      ? MONGODB_URI
      : `${MONGODB_URI}/devbyte?retryWrites=true&w=majority`;
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  }
  return client;
}

/**
 * Publishes/upserts a video publication snapshot into MongoDB Atlas 'publications' collection.
 * 
 * Schema:
 * {
 *   video_id: string,
 *   title: string,
 *   published_at: ISO string,
 *   platforms: {
 *     youtube: { status: "success" | "failed" | null, url: string | null },
 *     instagram: { status: "success" | "failed" | null, url: string | null },
 *     facebook: { status: "success" | "failed" | null, url: string | null },
 *     devbyte_wiki: { status: null, url: null }
 *   },
 *   performance: {
 *     gemini_script_s: number,
 *     validator_s: number,
 *     tts_s: number,
 *     render_s: number,
 *     s3_upload_s: number,
 *     yt_upload_s: number,
 *     fb_upload_s: number,
 *     ig_upload_s: number,
 *     total_s: number
 *   }
 * }
 */
async function publishToMongo(publication) {
  if (!MONGODB_URI) {
    console.warn('  ⚠️  [MongoDB] MONGODB_URI is not configured in .env. Skipping Atlas presentation archive update.');
    return false;
  }

  try {
    const mongoClient = await getMongoClient();
    const db = mongoClient.db('devbyte');
    const collection = db.collection('publications');

    await collection.updateOne(
      { video_id: publication.video_id },
      { $set: publication },
      { upsert: true }
    );

    console.log(`  ✔ [MongoDB Atlas] Upserted publication snapshot for '${publication.video_id}' in presentation archive.`);
    return true;
  } catch (err) {
    console.error(`  ❌ [MongoDB Atlas] Failed to publish '${publication.video_id}' to Atlas:`, err.message);
    return false;
  }
}

async function closeMongo() {
  if (client) {
    try {
      await client.close();
    } catch (err) {
      // ignore
    }
    client = null;
  }
}

module.exports = {
  publishToMongo,
  closeMongo,
};
