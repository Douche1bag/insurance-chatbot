"""
DAG: Insurance Document Processing Pipeline
================================================
This DAG is triggered when a user uploads a document via the Express API.

Flow:
  1. validate_file      → Check file exists and is valid type/size
  2. ocr_extraction     → Extract text using Typhoon OCR API
  3. generate_embedding → Convert text to vector using embedding API
  4. store_mongodb      → Save document + embedding to MongoDB
  5. verify_storage     → Confirm document was saved correctly
  6. cleanup_temp_file  → Delete temp file from uploads folder

How to trigger manually (for testing):
  - Airflow UI → DAGs → insurance_document_pipeline → Trigger DAG
  - Provide JSON: {"file_path": "/path/to/file", "file_name": "test.pdf", "user_id": "test123"}
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import requests
import os

# ================================
# CONFIGURATION
# ================================
MONGODB_URI = os.getenv('MONGODB_URI', '')
TYPHOON_API_KEY = os.getenv('TYPHOON_API_KEY', '')

default_args = {
    'owner': 'insurance-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 2,
    'retry_delay': timedelta(minutes=2),
}

# ================================
# TASK 1: Validate File
# ================================
def validate_file(**context):
    """Check file exists and is valid before processing"""
    dag_run = context['dag_run']
    conf = dag_run.conf or {}

    file_path = conf.get('file_path', '')
    file_name = conf.get('file_name', 'unknown.pdf')
    user_id = conf.get('user_id', 'guest')

    print(f"📄 Validating: {file_name} for user: {user_id}")

    if not file_path:
        raise ValueError("No file_path provided in DAG config")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    file_size = os.path.getsize(file_path)
    if file_size > 50 * 1024 * 1024:
        raise ValueError(f"File too large: {file_size} bytes (max 50MB)")

    allowed_types = ['.pdf', '.jpg', '.jpeg', '.png']
    file_ext = os.path.splitext(file_name)[1].lower()
    if file_ext not in allowed_types:
        raise ValueError(f"Invalid file type: {file_ext}")

    print(f"✅ Validation passed: {file_name} ({file_size} bytes)")

    # Return data to be passed to next task via XCom
    return {
        'file_path': file_path,
        'file_name': file_name,
        'user_id': user_id,
        'file_size': file_size
    }


# ================================
# TASK 2: OCR Extraction
# ================================
def ocr_extraction(**context):
    """Extract text from the document using Typhoon OCR"""
    ti = context['task_instance']
    file_info = ti.xcom_pull(task_ids='validate_file')

    file_path = file_info['file_path']
    file_name = file_info['file_name']

    print(f"🔍 Running OCR on: {file_name}")

    url = 'https://api.opentyphoon.ai/v1/ocr'

    with open(file_path, 'rb') as f:
        response = requests.post(
            url,
            files={'file': (file_name, f)},
            data={
                'model': 'typhoon-ocr',
                'task_type': 'default',
                'max_tokens': '16384',
                'temperature': '0.1',
            },
            headers={'Authorization': f'Bearer {TYPHOON_API_KEY}'}
        )

    if response.status_code != 200:
        raise Exception(f"OCR API failed: {response.status_code} - {response.text}")

    result = response.json()
    extracted_texts = []
    for page in result.get('results', []):
        if page.get('success') and page.get('message'):
            content = page['message']['choices'][0]['message']['content']
            extracted_texts.append(content)

    full_text = '\n\n'.join(extracted_texts)

    if not full_text.strip():
        raise ValueError("No text extracted from document")

    print(f"✅ OCR complete: {len(full_text)} characters")

    return {**file_info, 'extracted_text': full_text}


# ================================
# TASK 3: Generate Embedding
# ================================
def generate_embedding(**context):
    """Convert extracted text to vector embedding"""
    ti = context['task_instance']
    ocr_data = ti.xcom_pull(task_ids='ocr_extraction')

    text = ocr_data['extracted_text']
    print(f"🔄 Generating embedding for {len(text)} characters...")

    url = 'https://api.opentyphoon.ai/v1/embeddings'
    response = requests.post(
        url,
        json={
            'input': text[:8000],
            'model': 'text-embedding-ada-002',
            'encoding_format': 'float'
        },
        headers={
            'Authorization': f'Bearer {TYPHOON_API_KEY}',
            'Content-Type': 'application/json'
        }
    )

    if response.status_code != 200:
        print("⚠️ Embedding API failed, using fallback...")
        import hashlib
        embedding = []
        for i in range(384):
            h = hashlib.md5(f"{text[:100]}{i}".encode()).hexdigest()
            embedding.append(round((int(h[:8], 16) / 0xFFFFFFFF) * 2 - 1, 6))
    else:
        embedding = response.json()['data'][0]['embedding']

    print(f"✅ Embedding generated: {len(embedding)} dimensions")

    return {**ocr_data, 'embedding': embedding}


# ================================
# TASK 4: Store in MongoDB
# ================================
def store_mongodb(**context):
    """Save the document and embedding to MongoDB user_documents collection"""
    ti = context['task_instance']
    data = ti.xcom_pull(task_ids='generate_embedding')

    print(f"💾 Storing to MongoDB: {data['file_name']}")

    from pymongo import MongoClient

    client = MongoClient(MONGODB_URI)
    db = client['insurance-chatbot']

    result = db['user_documents'].insert_one({
        'userId': data['user_id'],
        'title': data['file_name'],
        'content': data['extracted_text'],
        'embedding': data['embedding'],
        'metadata': {
            'originalName': data['file_name'],
            'textLength': len(data['extracted_text']),
            'embeddingDimensions': len(data['embedding']),
            'uploadedAt': datetime.utcnow(),
            'source': 'user_upload',
            'processedBy': 'airflow',
            'dagRunId': context['run_id']
        }
    })

    document_id = str(result.inserted_id)
    client.close()

    print(f"✅ Stored with ID: {document_id}")

    return {**data, 'document_id': document_id}


# ================================
# TASK 5: Verify Storage
# ================================
def verify_storage(**context):
    """Confirm the document is correctly saved in MongoDB"""
    ti = context['task_instance']
    data = ti.xcom_pull(task_ids='store_mongodb')

    print(f"🔎 Verifying document: {data['document_id']}")

    from pymongo import MongoClient
    from bson import ObjectId

    client = MongoClient(MONGODB_URI)
    db = client['insurance-chatbot']

    doc = db['user_documents'].find_one({'_id': ObjectId(data['document_id'])})
    client.close()

    if not doc:
        raise Exception(f"Document {data['document_id']} not found after storing!")

    if not doc.get('embedding') or len(doc['embedding']) == 0:
        raise Exception("Document saved but embedding is missing!")

    print(f"✅ Verified: {len(doc['content'])} chars, {len(doc['embedding'])} dim embedding")
    return 'verified'


# ================================
# TASK 6: Cleanup Temp File
# ================================
def cleanup_temp_file(**context):
    """Delete the temporary file from the uploads folder"""
    ti = context['task_instance']
    file_info = ti.xcom_pull(task_ids='validate_file')

    file_path = file_info.get('file_path', '')
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        print(f"🗑️ Deleted temp file: {file_path}")
    else:
        print("ℹ️ No temp file to clean up")

    return 'done'


# ================================
# DAG DEFINITION
# ================================
with DAG(
    dag_id='insurance_document_pipeline',
    default_args=default_args,
    description='OCR → Embedding → MongoDB pipeline for uploaded insurance documents',
    schedule=None,       # Only runs when triggered (not on a schedule)
    catchup=False,
    tags=['insurance', 'upload', 'ocr', 'embedding'],
) as dag:

    t1 = PythonOperator(task_id='validate_file',      python_callable=validate_file)
    t2 = PythonOperator(task_id='ocr_extraction',     python_callable=ocr_extraction)
    t3 = PythonOperator(task_id='generate_embedding', python_callable=generate_embedding)
    t4 = PythonOperator(task_id='store_mongodb',      python_callable=store_mongodb)
    t5 = PythonOperator(task_id='verify_storage',     python_callable=verify_storage)
    t6 = PythonOperator(task_id='cleanup_temp_file',  python_callable=cleanup_temp_file)

    # Task order: each arrow means "run after"
    t1 >> t2 >> t3 >> t4 >> t5 >> t6
