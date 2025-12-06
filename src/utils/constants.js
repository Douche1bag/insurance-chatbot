export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.opentyphoon.ai/v1',
  apiKey: import.meta.env.VITE_API_KEY,
  model: import.meta.env.VITE_MODEL_NAME || 'typhoon-v2.1-12b-instruct',
  maxTokens: 1000,
  temperature: 0.6
};

export const SYSTEM_MESSAGE = {
  role: 'system',
  content: 'You are a helpful insurance policy assistant. You must answer only in Thai. Your job is to summarize insurance policies clearly and concisely.'
};

export const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'สวัสดีครับ! ผม คือผู้ช่วยสรุปกรมธรรม์ประกันภัย คุณสามารถวางข้อความกรมธรรม์ของคุณได้เลยครับ'
};

export const ERROR_MESSAGE = {
  role: 'assistant',
  content: 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง'
};

export const MESSAGES = {
  LOADING: 'กำลังประมวลผล...',
  PLACEHOLDER: 'วางข้อความกรมธรรม์ของคุณที่นี่...',
  HINT: 'กด Enter เพื่อส่งข้อความ • Shift + Enter เพื่อขึ้นบรรทัดใหม่'
};