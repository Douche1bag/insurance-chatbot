// Simple MongoDB connection test with SSL options
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function testMongoConnection() {
  console.log('🔍 Testing MongoDB connection with SSL options...\n');
  
  const uri = process.env.MONGODB_URI;
  console.log('Connection String:', uri?.replace(/:[^:@]+@/, ':****@'));

  // Try different connection options
  const connectionOptions = [
    {
      name: 'Standard connection',
      options: {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      }
    },
    {
      name: 'Connection with TLS disabled',
      options: {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        tls: false,
        ssl: false
      }
    },
    {
      name: 'Connection with TLS settings',
      options: {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        tls: true,
        tlsInsecure: true,
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true
      }
    }
  ];

  for (const { name, options } of connectionOptions) {
    console.log(`🔗 Trying: ${name}`);
    
    let client;
    try {
      client = new MongoClient(uri, options);
      await client.connect();
      
      // Test basic operation
      const db = client.db('insurance-chatbot');
      const collections = await db.listCollections().toArray();
      
      console.log(`✅ ${name}: SUCCESS! Found ${collections.length} collections`);
      break; // Stop on first success
      
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    } finally {
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }
    }
    console.log('');
  }
}

testMongoConnection();