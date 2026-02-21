// Environment variables - compatible with both Node.js and browser
const getEnvVar = (name, defaultValue = '') => {
  // For Node.js
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || defaultValue;
  }
  // For browser (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[name] || defaultValue;
  }
  return defaultValue;
};

export const API_CONFIG = {
  baseUrl: getEnvVar('VITE_API_BASE_URL', 'https://api.opentyphoon.ai/v1'),
  apiKey: getEnvVar('VITE_API_KEY'),
  model: getEnvVar('VITE_MODEL_NAME', 'typhoon-v2.5-30b-a3b-instruct'),
  maxTokens: 1000,
  temperature: 0.6
};

export const SYSTEM_MESSAGE = {
  role: 'system',
  content: 'You are a helpful insurance policy assistant. You must answer only in Thai. Your job is to summarize insurance policies clearly and concisely.'
};

export const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'สวัสดีครับ! คุณสามารถวางข้อความกรมธรรม์ของคุณได้เลยครับ'
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

export const APP_NAME = "InsureWise AI";