// Import Thai insurance embedding data to MongoDB
import dotenv from 'dotenv';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import mongoService from './src/services/mongoService.js';

dotenv.config();

async function importInsuranceEmbeddings() {
  console.log('📁 Importing Thai Insurance Embeddings to MongoDB...\n');

  try {
    // Read all JSON files from embeded_dataset folder
    console.log('📂 Reading embedding files from embeded_dataset folder...');
    const datasetPath = '/Users/aum/Downloads/embeded_dataset';
    const files = await readdir(datasetPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`✅ Found ${jsonFiles.length} JSON files to process\n`);

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoService.connect();
    console.log('✅ Connected successfully!\n');

    // Create indexes for better performance
    console.log('📊 Creating database indexes...');
    await mongoService.createIndexes();
    console.log('✅ Indexes created!\n');

    let totalDocuments = 0;
    let totalStored = 0;

    // Process each JSON file
    for (const filename of jsonFiles) {
      const filePath = join(datasetPath, filename);
      
      console.log(`📄 Processing: ${filename}`);
      
      try {
        const fileContent = await readFile(filePath, 'utf-8');
        const insuranceData = JSON.parse(fileContent);
        
        if (!Array.isArray(insuranceData)) {
          console.log(`   ⚠️  Skipping ${filename} - not an array format`);
          continue;
        }

        console.log(`   📊 Found ${insuranceData.length} documents in ${filename}`);
        totalDocuments += insuranceData.length;

        // Store documents in batches for better performance
        const batchSize = 50;
        let fileStored = 0;

        for (let i = 0; i < insuranceData.length; i += batchSize) {
          const batch = insuranceData.slice(i, i + batchSize);
          const promises = batch.map(async (doc, index) => {
            try {
              // Prepare document for storage
              const document = {
                title: `${filename} - ${doc.file || 'Document'} (Page ${doc.page || index + 1})`,
                content: doc.text || doc.content || '',
                embedding: doc.embedding || [],
                metadata: {
                  sourceFile: filename,
                  originalFile: doc.file || null,
                  pageNumber: doc.page || null,
                  language: 'thai',
                  documentType: 'insurance_policy',
                  source: 'Thai Insurance Documents',
                  embeddingDimensions: (doc.embedding || []).length,
                  textLength: (doc.text || doc.content || '').length,
                  importedAt: new Date()
                }
              };

              // Store using MongoDB service
              const db = await mongoService.connect();
              const collection = db.collection('thai_insurance_docs');
              const result = await collection.insertOne(document);
              
              return result.insertedId;
            } catch (error) {
              console.error(`     ❌ Error storing document ${index} from ${filename}:`, error.message);
              return null;
            }
          });

          const results = await Promise.allSettled(promises);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
          fileStored += successCount;

          console.log(`     Batch ${Math.floor(i/batchSize) + 1}: ${successCount}/${batch.length} documents imported`);
        }

        totalStored += fileStored;
        console.log(`   ✅ ${filename}: ${fileStored}/${insuranceData.length} documents imported\n`);

      } catch (fileError) {
        console.error(`   ❌ Error processing ${filename}:`, fileError.message);
      }
    }

    console.log(`🎉 IMPORT COMPLETE!`);
    console.log(`📊 Total files processed: ${jsonFiles.length}`);
    console.log(`📋 Total documents found: ${totalDocuments}`);
    console.log(`✅ Total documents imported: ${totalStored}`);
    console.log(`🗃️  Collection: thai_insurance_docs`);
    console.log(`📝 Ready for vector search operations!\n`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    
    if (error.message.includes('ENOENT')) {
      console.log('🔧 Make sure the embeded_dataset folder exists at: /Users/aum/Downloads/embeded_dataset');
    }
    
    if (error.message.includes('authentication') || error.message.includes('password')) {
      console.log('🔧 Check your MongoDB credentials in the .env file');
    }
  } finally {
    await mongoService.disconnect();
  }
}

// Run the import
importInsuranceEmbeddings();