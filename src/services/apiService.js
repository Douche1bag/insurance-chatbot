import { API_CONFIG, SYSTEM_MESSAGE } from '../utils/constants.js';

export class APIService {
  static async sendMessage(messages) {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [SYSTEM_MESSAGE, ...messages],
          max_tokens: API_CONFIG.maxTokens,
          temperature: API_CONFIG.temperature
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid response format from API');
      }

      return {
        success: true,
        message: data.choices[0].message.content
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}