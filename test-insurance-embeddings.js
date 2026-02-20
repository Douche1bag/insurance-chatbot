// Test MongoDB by storing the Thai insurance embedding data
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import mongoService from './src/services/mongoService.js';

dotenv.config();

async function testWithInsuranceEmbeddings() {
  console.log('🧪 Testing MongoDB with Thai Insurance Embeddings...\n');

  try {
    // Load the embedding file
    console.log('📁 Loading insurance embedding data...');
    const filePath = './src/services/emb_กรมธรรมประกันชีวิต1.json';
    const fileContent = await readFile(filePath, 'utf-8');
    const insuranceData = JSON.parse(fileContent);
    
    console.log(`✅ Loaded ${insuranceData.length} insurance documents\n`);

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoService.connect();
    console.log('✅ Connected successfully!\n');

    // Create indexes for better performance
    console.log('📊 Creating database indexes...');
    await mongoService.createIndexes();
    console.log('✅ Indexes created!\n');

    // Store documents in batches for better performance
    console.log('💾 Storing insurance documents with embeddings...');
    const batchSize = 50;
    let stored = 0;

    for (let i = 0; i < insuranceData.length; i += batchSize) {
      const batch = insuranceData.slice(i, i + batchSize);
      const promises = batch.map(async (doc, index) => {
        try {
          // Prepare document for storage
          const document = {
            title: `Insurance Document - ${doc.file} (Page ${doc.page})`,
            content: doc.text,
            embedding: doc.embedding,
            metadata: {
              originalFile: doc.file,
              pageNumber: doc.page,
              language: 'thai',
              documentType: 'insurance_policy',
              source: 'กรมธรรมประกันชีวิต',
              embeddingDimensions: doc.embedding.length,
              textLength: doc.text.length,
              createdAt: new Date()
            }
          };

          // Store using MongoDB service
          const db = await mongoService.connect();
          const collection = db.collection('thai_insurance_docs');
          const result = await collection.insertOne(document);
          
          return result.insertedId;
        } catch (error) {
          console.error(`❌ Error storing document ${index}:`, error.message);
          return null;
        }
      });

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      stored += successCount;

      console.log(`   Batch ${Math.floor(i/batchSize) + 1}: ${successCount}/${batch.length} documents stored`);
    }

    console.log(`\n✅ Successfully stored ${stored}/${insuranceData.length} documents!\n`);

    // Test vector similarity search
    console.log('🔍 Testing similarity search with Thai queries...');
    const testQueries = [
      'ประกันชีวิต',
      'เบี้ยประกันภัย',
      'ผู้รับประโยชน์',
      'การเคลม',
      'สัญญาประกันภัย'
    ];

    for (const query of testQueries) {
      try {
        // Manual similarity search since we don't have Atlas Search set up yet
        const results = await searchSimilarDocuments(query, insuranceData);
        console.log(`   Query: "${query}" -> Found ${results.length} similar documents`);
        
        if (results.length > 0) {
          console.log(`     Top result: ${results[0].title} (similarity: ${results[0].similarity.toFixed(4)})`);
          console.log(`     Content preview: ${results[0].content.substring(0, 100)}...\n`);
        }
      } catch (error) {
        console.error(`❌ Error searching for "${query}":`, error.message);
      }
    }

    // Test retrieval from database
    console.log('📚 Testing document retrieval from database...');
    const db = await mongoService.connect();
    const collection = db.collection('thai_insurance_docs');
    
    const totalDocs = await collection.countDocuments();
    console.log(`   Total documents in database: ${totalDocs}`);
    
    const sampleDoc = await collection.findOne({});
    if (sampleDoc) {
      console.log(`   Sample document title: ${sampleDoc.title}`);
      console.log(`   Embedding dimensions: ${sampleDoc.embedding.length}`);
      console.log(`   Text length: ${sampleDoc.content.length} characters\n`);
    }

    // Create a search index recommendation
    console.log('📋 Vector Search Index Recommendation:');
    console.log('To enable fast vector search in MongoDB Atlas:');
    console.log('1. Go to your Atlas cluster → Search → Create Index');
    console.log('2. Use this configuration:');
    console.log(JSON.stringify({
      "name": "thai_insurance_vector_index",
      "type": "vectorSearch",
      "definition": {
        "fields": [
          {
            "type": "vector",
            "path": "embedding",
            "numDimensions": insuranceData[0]?.embedding?.length || 1536,
            "similarity": "cosine"
          },
          {
            "type": "filter",
            "path": "metadata.language"
          },
          {
            "type": "filter", 
            "path": "metadata.documentType"
          }
        ]
      }
    }, null, 2));

    console.log('\n🎉 MongoDB test with insurance embeddings completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ENOENT')) {
      console.log('🔧 Make sure the embedding file exists at: ./src/services/emb_กรมธรรมประกันชีวิต1.json');
    }
    
    if (error.message.includes('<db_password>')) {
      console.log('🔧 Update your .env file with the correct MongoDB password');
    }
  } finally {
    await mongoService.disconnect();
  }
}

// Simple similarity search function for testing
async function searchSimilarDocuments(query, documents, topK = 3) {
  // Generate simple embedding for query (this is a basic implementation)
  const queryEmbedding = generateSimpleEmbedding(query);
  
  // Calculate similarities
  const similarities = documents.map(doc => ({
    title: `${doc.file} (Page ${doc.page})`,
    content: doc.text,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    metadata: {
      file: doc.file,
      page: doc.page
    }
  }));

  // Sort by similarity and return top results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// Simple embedding generation (for query)
function generateSimpleEmbedding(text, dimensions = 1536) {
  const embedding = new Array(dimensions).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    const index = char % dimensions;
    embedding[index] += Math.sin(char * 0.1) * Math.cos(i * 0.1);
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
}

// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
}

// Run the test
testWithInsuranceEmbeddings();