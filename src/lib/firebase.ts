import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

let cachedFBConfig: any = null;

const getFirebaseConfig = async () => {
  try {
    // 1. Tenta do build-time (VITE_)
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    if (envConfig) return JSON.parse(envConfig);

    // 2. Tenta do cache dinâmico
    if (cachedFBConfig) return cachedFBConfig;

    // 3. Tenta buscar da Netlify Function (Radar oficial para Netlify Drop)
    try {
      const res = await fetch('/.netlify/functions/config');
      if (res.ok) {
        const remote = await res.json();
        if (remote.FIREBASE_CONFIG) {
          const parsed = typeof remote.FIREBASE_CONFIG === 'string' ? JSON.parse(remote.FIREBASE_CONFIG) : remote.FIREBASE_CONFIG;
          cachedFBConfig = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    // 4. Fallback para API própria
    const res = await fetch('/api/config');
    const remote = await res.json();
    if (remote.FIREBASE_CONFIG) {
      const parsed = typeof remote.FIREBASE_CONFIG === 'string' ? JSON.parse(remote.FIREBASE_CONFIG) : remote.FIREBASE_CONFIG;
      cachedFBConfig = parsed;
      return parsed;
    }

    return firebaseConfig;
  } catch (e) {
    return firebaseConfig;
  }
};

export async function saveOcorrenciaFirestore(id: string, data: any) {
  const config = await getFirebaseConfig();
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);

  await setDoc(doc(db, "ocorrencias", id), {
    ...data,
    createdAt: new Date().toISOString()
  });
}

export async function getOcorrenciaFirestore(id: string) {
  const config = await getFirebaseConfig();
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);

  const docSnap = await getDoc(doc(db, "ocorrencias", id));
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}
