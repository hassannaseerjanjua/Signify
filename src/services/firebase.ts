import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { UserSession, SignedDocument } from '../types';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Place your Firebase Configuration here if you want to use live services:
export const firebaseConfig = {
  apiKey: 'AIzaSyDZ8N6-txUWcS_qX_1sTrHVKh2dLshUsEk',
  authDomain: 'signify-9f89d.firebaseapp.com',
  projectId: 'signify-9f89d',
  storageBucket: 'signify-9f89d.firebasestorage.app',
  messagingSenderId: '336226571800',
  appId: '1:336226571800:android:85ba2fe288b7ec3be4156d',
};

// Check if configuration is active (Set this to a valid key to activate Live mode)
const isFirebaseConfigured =
  firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';

let liveAuth: any = null;
let liveDb: any = null;
let liveStorage: any = null;

// Set to true if you upgrade to the Blaze plan to enable remote document file storage
const isStorageEnabled = false;

if (isFirebaseConfigured) {
  try {
    liveAuth = auth();
    liveDb = firestore();
    if (isStorageEnabled) {
      liveStorage = storage();
    }

    // Configure Google Sign-In
    // If you have a specific webClientId from your Firebase Console / google-services.json, configure it here.
    // E.g., webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
    GoogleSignin.configure({
      // webClientId is optional for Android basic sign-in but required to authenticate with Firebase Auth
      // If client ID is present, add it here:
      webClientId:
        '336226571800-7n08qiom0he4345n91puc6cdgdlg3h9g.apps.googleusercontent.com',
    });

    console.log(
      '🔥 Firebase initialized successfully in LIVE mode via React Native Firebase!',
    );
  } catch (error) {
    console.error(
      '❌ Failed to initialize live Firebase, falling back to Sandbox Mode:',
      error,
    );
    liveAuth = null;
    liveDb = null;
    liveStorage = null;
  }
} else {
  console.log(
    'ℹ️ Running in Firebase SANDBOX Mode. Authentications and uploads will be stored locally.',
  );
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
AsyncStorage.getItem(STORAGE_KEYS.currentUser).then(userJson => {
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

    // If live, we listen to native firebase auth changes
    if (liveAuth) {
      return liveAuth.onAuthStateChanged((fbUser: any) => {
        if (fbUser) {
          cachedCurrentUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName:
              fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
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
      const credential = await liveAuth.signInWithEmailAndPassword(
        email,
        password,
      );
      const user = credential.user;
      cachedCurrentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || email.split('@')[0],
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.currentUser,
        JSON.stringify(cachedCurrentUser),
      );
      notifyAuthListeners();
      return cachedCurrentUser;
    } else {
      // Sandbox implementation
      if (email && password.length >= 6) {
        cachedCurrentUser = {
          uid: 'sandbox-uid-' + email.replace(/[^a-zA-Z0-9]/g, ''),
          email: email,
          displayName: email.split('@')[0],
          createdAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          STORAGE_KEYS.currentUser,
          JSON.stringify(cachedCurrentUser),
        );
        notifyAuthListeners();
        return cachedCurrentUser;
      } else {
        throw new Error(
          'Invalid credentials or password too short (min 6 chars).',
        );
      }
    }
  },

  // Auth: Signup / Register
  register: async (email: string, password: string): Promise<UserSession> => {
    if (liveAuth) {
      const credential = await liveAuth.createUserWithEmailAndPassword(
        email,
        password,
      );
      const user = credential.user;
      cachedCurrentUser = {
        uid: user.uid,
        email: user.email,
        displayName: email.split('@')[0],
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.currentUser,
        JSON.stringify(cachedCurrentUser),
      );
      notifyAuthListeners();
      return cachedCurrentUser;
    } else {
      // Sandbox implementation
      return firebaseService.login(email, password);
    }
  },

  // Auth: Google Social Login
  loginWithGoogle: async (): Promise<UserSession> => {
    if (liveAuth) {
      try {
        // Ensure Play Services are available (Android only)
        if (Platform.OS === 'android') {
          await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true,
          });
        }

        // Trigger Google Sign-in flow
        const signInResult = await GoogleSignin.signIn();

        let idToken = (signInResult as any).idToken;
        if (!idToken && (signInResult as any).data) {
          idToken = (signInResult as any).data.idToken;
        }

        if (!idToken) {
          throw new Error(
            'Failed to retrieve ID Token from Google Sign-In. Ensure webClientId configuration matches Firebase Console client ID.',
          );
        }

        // Create native Firebase Auth credential
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);

        // Sign-in with credential
        const userCredential = await liveAuth.signInWithCredential(
          googleCredential,
        );
        const user = userCredential.user;

        cachedCurrentUser = {
          uid: user.uid,
          email: user.email,
          displayName:
            user.displayName || user.email?.split('@')[0] || 'Google User',
          createdAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          STORAGE_KEYS.currentUser,
          JSON.stringify(cachedCurrentUser),
        );
        notifyAuthListeners();
        return cachedCurrentUser;
      } catch (error: any) {
        console.error('❌ Google Sign-In Error:', error);
        throw error;
      }
    } else {
      // Sandbox Mode Google Login
      cachedCurrentUser = {
        uid: 'sandbox-uid-google-user',
        email: 'sandbox.google@example.com',
        displayName: 'Sandbox Google User',
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.currentUser,
        JSON.stringify(cachedCurrentUser),
      );
      notifyAuthListeners();
      return cachedCurrentUser;
    }
  },

  // Auth: Logout
  logout: async (): Promise<void> => {
    if (liveAuth) {
      await liveAuth.signOut();
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        console.log("Google Sign-Out failed or wasn't active:", e);
      }
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
    signaturePosition?: any,
  ): Promise<SignedDocument> => {
    const docId = 'doc_' + Math.random().toString(36).substring(2, 9);
    let finalDownloadUrl = localSignedUri; // Local URI is used if sandbox or offline

    if (liveStorage && liveDb) {
      try {
        const fileRef = liveStorage.ref(
          `signed_documents/${userId}/${docId}.jpg`,
        );
        // Clean native file paths for Android
        const uploadUri =
          Platform.OS === 'android'
            ? localSignedUri.replace('file://', '')
            : localSignedUri;

        await fileRef.putFile(uploadUri);
        finalDownloadUrl = await fileRef.getDownloadURL();
        console.log(
          '🌐 Document uploaded to Firebase Storage:',
          finalDownloadUrl,
        );
      } catch (err) {
        console.error(
          '❌ Firebase upload failed, using local URI for document database save:',
          err,
        );
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
      signaturePosition,
    };

    // Save metadata
    if (liveDb) {
      try {
        await liveDb
          .collection('users')
          .doc(userId)
          .collection('documents')
          .doc(docId)
          .set(docData);
        console.log('💾 Metadata saved to Firestore.');
      } catch (err) {
        console.error('❌ Firestore save failed, syncing locally.', err);
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
        const querySnapshot = await liveDb
          .collection('users')
          .doc(userId)
          .collection('documents')
          .orderBy('createdAt', 'desc')
          .get();
        const docs: SignedDocument[] = [];
        querySnapshot.forEach((d: any) => {
          docs.push({ id: d.id, ...d.data() } as SignedDocument);
        });
        return docs;
      } catch (err) {
        console.error('❌ Firestore read failed, loading local copies:', err);
        return loadDocumentsLocally(userId);
      }
    } else {
      return loadDocumentsLocally(userId);
    }
  },
};

// Local storage saving helpers
async function saveDocumentLocally(userId: string, document: SignedDocument) {
  try {
    const list = await loadDocumentsLocally(userId);
    list.unshift(document); // Add to top
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.documents}_${userId}`,
      JSON.stringify(list),
    );
  } catch (err) {
    console.error('Error saving document locally', err);
  }
}

async function loadDocumentsLocally(userId: string): Promise<SignedDocument[]> {
  try {
    const listJson = await AsyncStorage.getItem(
      `${STORAGE_KEYS.documents}_${userId}`,
    );
    return listJson ? JSON.parse(listJson) : [];
  } catch (err) {
    console.error('Error loading local documents list', err);
    return [];
  }
}
