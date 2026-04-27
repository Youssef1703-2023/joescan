import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, getDocFromServer, getDocs, doc, setDoc, addDoc, collection, query, where, arrayUnion, arrayRemove } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeEK8gsAAAAAJMULD1_JbPaewS5nWXgYPNKNd0Q'),
  isTokenAutoRefreshEnabled: true
});
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const functions = getFunctions(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface UserProfileDocument {
  uid: string;
  email: string | null;
  name: string | null;
  username?: string | null;
  avatarURL?: string | null;
  tier: SubscriptionTier;
  subscriptionExpiry?: Date | null;
  completedLessons?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const ADMIN_EMAIL = 'joetech.dev.systems@gmail.com';

// ─── Profile Sync (Firestore-based, cross-device) ───

export async function getUserProfile(uid: string): Promise<UserProfileDocument | null> {
  try {
    const userDoc = await getDocFromServer(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfileDocument;
    }
  } catch (err) {
    console.error("Failed to fetch user profile", err);
  }
  return null;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfileDocument>): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error("Failed to update user profile", err);
    throw err;
  }
}

export async function ensureUserProfile(uid: string, email: string | null, displayName: string | null): Promise<UserProfileDocument> {
  const existing = await getUserProfile(uid);
  if (existing) {
    // Fix: if we now have email/name but the stored doc doesn't, patch it
    const patches: Record<string, any> = {};
    if (email && (!existing.email || existing.email === '')) {
      patches.email = email;
    }
    if (displayName && (!existing.name || existing.name === '')) {
      patches.name = displayName;
    }
    if (Object.keys(patches).length > 0) {
      patches.updatedAt = new Date().toISOString();
      try {
        await setDoc(doc(db, 'users', uid), patches, { merge: true });
        return { ...existing, ...patches };
      } catch (err) {
        console.error("Failed to patch user profile:", err);
      }
    }
    return existing;
  }
  
  // Create initial profile — convert nulls to empty strings for Firestore rules compatibility
  const newProfile: UserProfileDocument = {
    uid,
    email: email || '',
    name: displayName || '',
    tier: 'free',
    completedLessons: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'users', uid), newProfile, { merge: true });
  } catch (err) {
    console.error("Failed to create user profile:", err);
  }
  return newProfile;
}

export function isCurrentUserAdmin(): boolean {
  return auth.currentUser?.email === ADMIN_EMAIL;
}

export async function getUserTier(uid: string): Promise<SubscriptionTier> {
  if (auth.currentUser?.email === ADMIN_EMAIL) return 'enterprise';
  try {
    const userDoc = await getDocFromServer(doc(db, 'users', uid));
    if (userDoc.exists() && userDoc.data().tier) {
      return userDoc.data().tier as SubscriptionTier;
    }
  } catch (err) {
    console.error("Failed to fetch user tier, defaulting to free", err);
  }
  return 'free';
}

export async function upgradeUserTier(uid: string, newTier: SubscriptionTier, durationDays: number = 30): Promise<void> {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + durationDays);
  
  await setDoc(doc(db, 'users', uid), {
    tier: newTier,
    subscriptionExpiry: expiry
  }, { merge: true });
}

// ─── Activity Logger ───
export type ActivityType = 'login' | 'scan' | 'upgrade' | 'ban' | 'unban' | 'promo_create' | 'promo_delete' | 'ticket_create' | 'ticket_reply' | 'apikey_create' | 'apikey_delete' | 'profile_update' | 'config_update' | 'flag_update' | 'broadcast' | 'user_deleted';

export async function logActivity(action: ActivityType, details: string = '', targetUser?: string) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, 'activityLog'), {
      userId: user.uid,
      email: user.email,
      action,
      details,
      targetUser: targetUser || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to log activity", err);
  }
}

// ─── Ban Check ───
export async function isUserBanned(uid: string): Promise<{banned: boolean, reason?: string}> {
  try {
    const banDoc = await getDocFromServer(doc(db, 'bannedUsers', uid));
    if (banDoc.exists() && banDoc.data().active) {
      return { banned: true, reason: banDoc.data().reason || 'Account suspended' };
    }
  } catch (err) {
    console.error("Ban check failed", err);
  }
  return { banned: false };
}

export async function banUser(uid: string, reason: string) {
  await setDoc(doc(db, 'bannedUsers', uid), {
    uid,
    reason,
    active: true,
    bannedAt: new Date().toISOString(),
    bannedBy: auth.currentUser?.email,
  });
  await logActivity('ban', `Banned user: ${reason}`, uid);
}

export async function unbanUser(uid: string) {
  await setDoc(doc(db, 'bannedUsers', uid), { active: false }, { merge: true });
  await logActivity('unban', `Unbanned user`, uid);
}

// ─── Cyber Academy Progress ───
export async function updateLessonProgress(uid: string, lessonId: string, completed: boolean) {
  try {
    await setDoc(doc(db, 'users', uid), {
      completedLessons: completed ? arrayUnion(lessonId) : arrayRemove(lessonId),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error("Failed to update lesson progress", err);
    throw err;
  }
}
