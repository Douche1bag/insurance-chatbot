// This is exmple code for testing a MongoDB connection

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const uri = process.env.MONGODB_URI;

async function testConnection() {
  if (!uri) {
    console.error('MONGODB_URI is not set. Check your .env file.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully!');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message || err);
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch (_) {
      // ignore close errors
    }
  }
}

testConnection();