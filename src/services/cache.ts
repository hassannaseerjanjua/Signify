import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignaturePosition } from '../types';

export interface DocumentDraft {
  documentUri: string;
  documentName?: string;
  templateId: string | null;
  signatureUri: string | null;
  signaturePosition: SignaturePosition | null;
  timestamp: string;
}

const CACHE_KEYS = {
  signatureTemplate: '@signify_signature_template',
  documentDraft: '@signify_active_draft',
};

export const cacheService = {
  // Signature Template Cache
  saveSignatureTemplate: async (base64Uri: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.signatureTemplate, base64Uri);
    } catch (err) {
      console.error('Error caching signature template:', err);
    }
  },

  getSignatureTemplate: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(CACHE_KEYS.signatureTemplate);
    } catch (err) {
      console.error('Error getting signature template:', err);
      return null;
    }
  },

  clearSignatureTemplate: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.signatureTemplate);
    } catch (err) {
      console.error('Error clearing signature template:', err);
    }
  },

  // Document Draft Cache
  saveDraft: async (draft: DocumentDraft): Promise<void> => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.documentDraft, JSON.stringify(draft));
    } catch (err) {
      console.error('Error caching active draft:', err);
    }
  },

  getDraft: async (): Promise<DocumentDraft | null> => {
    try {
      const draftJson = await AsyncStorage.getItem(CACHE_KEYS.documentDraft);
      return draftJson ? JSON.parse(draftJson) : null;
    } catch (err) {
      console.error('Error getting active draft:', err);
      return null;
    }
  },

  clearDraft: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.documentDraft);
    } catch (err) {
      console.error('Error clearing active draft:', err);
    }
  }
};
