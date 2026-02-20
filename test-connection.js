// Simple MongoDB connection test
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🔍 Diagnosing MongoDB Connection...\n');
  
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE;
  
  console.log('Connection String:', uri.replace(/:[^:@]+@/, ':****@')); // Hide password
  console.log('Database Name:', dbName);
  console.log('');

  let client;
  try {
    console.log('🔗 Attempting to connect...');
    
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
    });

    // Test connection
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Test database access
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log(`📊 Database "${dbName}" has ${collections.length} collections`);
    
    // Test basic operation
    const testCollection = db.collection('connection_test');
    const testDoc = { message: 'Connection test', timestamp: new Date() };
    const result = await testCollection.insertOne(testDoc);
    console.log('✅ Test document inserted:', result.insertedId);
    
    // Clean up test document
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('🧹 Test document cleaned up');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n🔧 Possible solutions:');
      console.log('1. Check if your internet connection is working');
      console.log('2. Verify the cluster URL is correct');
      console.log('3. Make sure your MongoDB Atlas cluster is running');
      console.log('4. Check if your IP address is whitelisted in Atlas');
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n🔧 Authentication issue:');
      console.log('1. Verify username and password are correct');
      console.log('2. Check if user has proper database permissions');
    }
    
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Connection closed');
    }
  }
}

testConnection();