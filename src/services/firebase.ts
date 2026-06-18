import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSession, SignedDocument } from '../types';

// Place your Firebase Configuration here if you want to use live services:
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if configuration is active
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY";

let liveAuth: any = null;
let liveDb: any = null;
let liveStorage: any = null;

if (isFirebaseConfigured) {
  try {
    // Dynamically import Firebase libraries only if configured to avoid potential load issues
    const { initializeApp } = require('firebase/app');
    const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
    const { getFirestore } = require('firebase/firestore');
    const { getStorage } = require('firebase/storage');

    const app = initializeApp(firebaseConfig);
    liveAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    liveDb = getFirestore(app);
    liveStorage = getStorage(app);
    console.log("🔥 Firebase initialized successfully in LIVE mode!");
  } catch (error) {
    console.error("❌ Failed to initialize live Firebase, falling back to Sandbox Mode:", error);
  }
} else {
  console.log("ℹ️ Running in Firebase SANDBOX Mode. Authentications and uploads will be stored locally.");
}

// -------------------------------------------------------------
// SANDBOX / LOCAL STORAGE STORAGE FALLBACK KEY NAMES
// -------------------------------------------------------------
const STORAGE_KEYS = {
  currentUser: '@signify_current_user',
  documents: '@signify_documents_history',
};

// State listeners for auth
type AuthCallback = (user: UserSession | null) => void;
const authListeners = new Set<AuthCallback>();
let cachedCurrentUser: UserSession | null = null;

// Initialize sandbox auth cache
AsyncStorage.getItem(STORAGE_KEYS.currentUser).then((userJson) => {
  if (userJson) {
    cachedCurrentUser = JSON.parse(userJson);
    notifyAuthListeners();
  }
});

const notifyAuthListeners = () => {
  authListeners.forEach(listener => listener(cachedCurrentUser));
};

export const firebaseService = {
  // Check active mode
  isLive: () => isFirebaseConfigured && liveAuth !== null,

  // Auth: Listen to authentication updates
  onAuthStateChanged: (callback: AuthCallback) => {
    authListeners.add(callback);
    // Trigger immediately with current cached state
    callback(cachedCurrentUser);
    
    // If live, we would listen to firebase auth changes here
    if (liveAuth) {
      const { onAuthStateChanged: fbOnAuthStateChanged } = require('firebase/auth');
      return fbOnAuthStateChanged(liveAuth, (fbUser: any) => {
        if (fbUser) {
          cachedCurrentUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            createdAt: new Date().toISOString(),
          };
        } else {
          cachedCurrentUser = null;
        }
        notifyAuthListeners();
        callback(cachedCurrentUser);
      });
    }

    // Return unsubscriber for sandbox mode
    return () => {
      authListeners.delete(callback);
    };
  },

  // Auth: Login
  login: async (email: string, password: string): Promise<UserSession> => {
    if (liveAuth) {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const credential = await signInWithEmailAndPassword(liveAuth, email, password);
      const user = credential.user;
      cachedCurrentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || email.split('@')[0],
        createdAt: new Date().toISOString()
      };
      await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(cachedCurrentUser));
      notifyAuthListeners();
      return cachedCurrentUser;
    } else {
      // Sandbox implementation
      if (email && password.length >= 6) {
        cachedCurrentUser = {
          uid: 'sandbox-uid-' + email.replace(/[^a-zA-Z0-9]/g, ''),
          email: email,
          displayName: email.split('@')[0],
          createdAt: new Date().toISOString()
        };
        await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(cachedCurrentUser));
        notifyAuthListeners();
        return cachedCurrentUser;
      } else {
        throw new Error("Invalid credentials or password too short (min 6 chars).");
      }
    }
  },

  // Auth: Signup / Register
  register: async (email: string, password: string): Promise<UserSession> => {
    if (liveAuth) {
      const { createUserWithEmailAndPassword } = require('firebase/auth');
      const credential = await createUserWithEmailAndPassword(liveAuth, email, password);
      const user = credential.user;
      cachedCurrentUser = {
        uid: user.uid,
        email: user.email,
        displayName: email.split('@')[0],
        createdAt: new Date().toISOString()
      };
      await AsyncStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(cachedCurrentUser));
      notifyAuthListeners();
      return cachedCurrentUser;
    } else {
      // Sandbox implementation
      return firebaseService.login(email, password);
    }
  },

  // Auth: Logout
  logout: async (): Promise<void> => {
    if (liveAuth) {
      const { signOut } = require('firebase/auth');
      await signOut(liveAuth);
    }
    cachedCurrentUser = null;
    await AsyncStorage.removeItem(STORAGE_KEYS.currentUser);
    notifyAuthListeners();
  },

  // Upload/Save Signed Document
  uploadAndSaveDocument: async (
    userId: string, 
    documentName: string, 
    localSignedUri: string,
    originalUri: string | null,
    signatureUri?: string,
    signaturePosition?: any
  ): Promise<SignedDocument> => {
    const docId = 'doc_' + Math.random().toString(36).substring(2, 9);
    let finalDownloadUrl = localSignedUri; // Local URI is used if sandbox or offline

    if (liveStorage && liveDb) {
      try {
        const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');

        // Fetch local file blob
        const response = await fetch(localSignedUri);
        const blob = await response.blob();
        
        // Upload to Firebase Storage
        const fileRef = ref(liveStorage, `signed_documents/${userId}/${docId}.jpg`);
        await uploadBytes(fileRef, blob);
        finalDownloadUrl = await getDownloadURL(fileRef);
        console.log("🌐 Document uploaded to Firebase Storage:", finalDownloadUrl);
      } catch (err) {
        console.error("❌ Firebase upload failed, using local URI for document database save:", err);
      }
    }

    const docData: SignedDocument = {
      id: docId,
      name: documentName,
      originalUri,
      signedUri: finalDownloadUrl,
      createdAt: new Date().toISOString(),
      status: 'completed',
      signatureUri,
      signaturePosition
    };

    // Save metadata
    if (liveDb) {
      try {
        const { doc, setDoc } = require('firebase/firestore');
        await setDoc(doc(liveDb, `users/${userId}/documents`, docId), docData);
        console.log("💾 Metadata saved to Firestore.");
      } catch (err) {
        console.error("❌ Firestore save failed, syncing locally.", err);
        await saveDocumentLocally(userId, docData);
      }
    } else {
      // Sandbox/local fallback saving
      await saveDocumentLocally(userId, docData);
    }

    return docData;
  },

  // Retrieve Documents list
  getDocuments: async (userId: string): Promise<SignedDocument[]> => {
    if (liveDb) {
      try {
        const { collection, getDocs, query, orderBy } = require('firebase/firestore');
        const docRef = collection(liveDb, `users/${userId}/documents`);
        const q = query(docRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const docs: SignedDocument[] = [];
        querySnapshot.forEach((d: any) => {
          docs.push({ id: d.id, ...d.data() } as SignedDocument);
        });
        return docs;
      } catch (err) {
        console.error("❌ Firestore read failed, loading local copies:", err);
        return loadDocumentsLocally(userId);
      }
    } else {
      return loadDocumentsLocally(userId);
    }
  }
};

// Local storage saving helpers
async function saveDocumentLocally(userId: string, document: SignedDocument) {
  try {
    const list = await loadDocumentsLocally(userId);
    list.unshift(document); // Add to top
    await AsyncStorage.setItem(`${STORAGE_KEYS.documents}_${userId}`, JSON.stringify(list));
  } catch (err) {
    console.error("Error saving document locally", err);
  }
}

async function loadDocumentsLocally(userId: string): Promise<SignedDocument[]> {
  try {
    const listJson = await AsyncStorage.getItem(`${STORAGE_KEYS.documents}_${userId}`);
    return listJson ? JSON.parse(listJson) : [];
  } catch (err) {
    console.error("Error loading local documents list", err);
    return [];
  }
}
