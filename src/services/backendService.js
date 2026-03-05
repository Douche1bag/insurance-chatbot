// src/services/backendService.js - Frontend API client for MongoDB Atlas backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class BackendService {
  async fetchDashboardStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/stats`);
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Backend Service - Dashboard Stats Error:', error);
      throw error;
    }
  }

  async fetchPolicyDocuments(searchTerm = '', limit = 10) {
    try {
      const params = new URLSearchParams({ search: searchTerm, limit: limit.toString() });
      const response = await fetch(`${API_BASE_URL}/dashboard/policies?${params}`);
      if (!response.ok) throw new Error('Failed to fetch policies');
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Backend Service - Policies Error:', error);
      throw error;
    }
  }

  async fetchComparisonPolicies(limit = 20) {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      const response = await fetch(`${API_BASE_URL}/comparison/policies?${params}`);
      if (!response.ok) throw new Error('Failed to fetch comparison policies');
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Backend Service - Comparison Policies Error:', error);
      throw error;
    }
  }

  async fetchAdminAnalytics() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/analytics`);
      if (!response.ok) throw new Error('Failed to fetch admin analytics');
      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Backend Service - Admin Analytics Error:', error);
      throw error;
    }
  }

  async sendChatMessage(message, userId = 'anonymous') {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, userId })
      });
      if (!response.ok) throw new Error('Failed to send chat message');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Backend Service - Chat Error:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export default new BackendService();