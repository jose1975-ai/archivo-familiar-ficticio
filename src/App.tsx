import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Users, 
  Share2, 
  Eye, 
  Upload, 
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { INITIAL_FAMILIES, FamilyMember, Connection, cn } from './types';
import { Polaroid } from './components/Polaroid';
import { NetworkGraph } from './components/NetworkGraph';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';

enum OperationType {
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
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

// Page types
type Page = 'home' | 'families' | 'archive' | 'map' | 'observer';

interface PhotoEditModalProps {
  index: number;
  familyId: string;
  families: Record<string, FamilyMember>;
  onUpdateDescription: (description: string) => void;
  onSetAsCover: (index: number) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

const PhotoEditModal = ({ 
  index, 
  familyId, 
  families, 
  onUpdateDescription, 
  onSetAsCover, 
  onDelete, 
  onClose 
}: PhotoEditModalProps) => {
  const family = families[familyId];
  if (!family || !family.photos[index]) return null;
  const photo = family.photos[index];
  
  const [localDescription, setLocalDescription] = useState(photo.description || '');

  const handleSave = () => {
    onUpdateDescription(localDescription);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-vintage-ink/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-vintage-paper p-8 border border-vintage-border shadow-2xl max-w-2xl w-full"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-vintage-ink/40 hover:text-vintage-ink"
        >
          <X size={24} />
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-4 polaroid-shadow border border-gray-200">
            <img 
              src={photo.url} 
              alt="Editing" 
              className="w-full aspect-square object-cover grayscale"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="flex flex-col">
            <h3 className="typewriter-text text-xl mb-4 border-b border-vintage-border pb-2">Editar descripción</h3>
            <label className="typewriter-text text-xs uppercase text-vintage-ink/40 block mb-2">Descripción de la fotografía</label>
            <textarea 
              autoFocus
              rows={6}
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              placeholder="Escribe aquí la historia de esta imagen..."
              className="w-full typewriter-text border border-vintage-border p-4 focus:border-vintage-ink outline-none bg-transparent resize-none text-sm leading-relaxed flex-grow"
            />
            <div className="flex flex-col gap-2 mt-4">
              <button 
                onClick={() => onSetAsCover(index)}
                className="typewriter-text border border-vintage-ink py-2 uppercase tracking-widest text-xs hover:bg-vintage-ink hover:text-vintage-paper transition-all"
              >
                Usar como portada
              </button>
              <button 
                onClick={() => onDelete(index)}
                className="typewriter-text border border-red-800 text-red-800 py-2 uppercase tracking-widest text-xs hover:bg-red-800 hover:text-white transition-all"
              >
                Eliminar fotografía
              </button>
              <button 
                onClick={handleSave}
                className="typewriter-text bg-vintage-ink text-vintage-paper py-3 uppercase tracking-widest text-sm hover:opacity-90 transition-opacity"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [families, setFamilies] = useState<Record<string, FamilyMember>>(() => {
    const saved = localStorage.getItem('archive_families');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved families", e);
      }
    }
    return INITIAL_FAMILIES;
  });
  const [connections, setConnections] = useState<Connection[]>(() => {
    const saved = localStorage.getItem('archive_connections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved connections", e);
      }
    }
    return [
      { id: 'c1', source: 'alex', target: 'oscar', label: 'Colegio (desde pequeños)' },
      { id: 'c2', source: 'oscar', target: 'inaki', label: 'Primos' },
      { id: 'c3', source: 'inaki', target: 'linxia', label: 'Hermanos' },
      { id: 'c4', source: 'carmen', target: 'oscar', label: 'Residencia Madrid' },
      { id: 'c5', source: 'grupo', target: 'yasir', label: 'Feria de Almería → Conocen a Yasir' },
      { id: 'c6', source: 'oscar', target: 'grupo', label: 'Grupo' },
      { id: 'c7', source: 'alex', target: 'grupo', label: 'Grupo' },
      { id: 'c8', source: 'inaki', target: 'grupo', label: 'Grupo' },
      { id: 'c9', source: 'linxia', target: 'grupo', label: 'Grupo' },
      { id: 'c10', source: 'carmen', target: 'grupo', label: 'Grupo' },
    ];
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isBoxOpen, setIsBoxOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newConnSource, setNewConnSource] = useState('');
  const [newConnTarget, setNewConnTarget] = useState('');
  const [newConnLabel, setNewConnLabel] = useState('');
  const [mapPhotos, setMapPhotos] = useState<any[]>(() => {
    const saved = localStorage.getItem('archive_map_photos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved map photos", e);
      }
    }
    return [];
  });

  const lastSavedState = React.useRef<{
    families: string;
    connections: string;
  }>({ families: '', connections: '' });
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();
    
    // Check for quota exceeded
    if (lowerMessage.includes('quota') || lowerMessage.includes('exhausted') || lowerMessage.includes('limit')) {
      setSaveStatus('error');
      alert("Límite de cuota excedido: Has alcanzado el límite de escritura gratuito para hoy. Inténtalo de nuevo mañana.");
      return;
    }

    // Check for permission denied
    if (lowerMessage.includes('permission') || lowerMessage.includes('insufficient')) {
      setSaveStatus('error');
      alert("Error de permisos: No tienes autorización para realizar esta operación. Asegúrate de haber iniciado sesión correctamente.");
      return;
    }

    const errInfo: FirestoreErrorInfo = {
      error: message,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }, []);

  // Audio refs
  const creakAudio = React.useRef<HTMLAudioElement | null>(null);
  const shuffleAudio = React.useRef<HTMLAudioElement | null>(null);

  // LocalStorage persistence
  useEffect(() => {
    try {
      localStorage.setItem('archive_families', JSON.stringify(families));
    } catch (e) {
      console.warn("LocalStorage is full or unavailable", e);
    }
  }, [families]);

  useEffect(() => {
    try {
      localStorage.setItem('archive_connections', JSON.stringify(connections));
    } catch (e) {
      console.warn("LocalStorage is full or unavailable", e);
    }
  }, [connections]);

  useEffect(() => {
    try {
      localStorage.setItem('archive_map_photos', JSON.stringify(mapPhotos));
    } catch (e) {
      console.warn("LocalStorage is full or unavailable", e);
    }
  }, [mapPhotos]);

  // Auto-save to cloud
  useEffect(() => {
    if (!user || !autoSaveEnabled) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 5000); // Debounce for 5 seconds to avoid excessive writes

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [families, connections, user, autoSaveEnabled]);

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const initAudio = (url: string) => {
      const audio = new Audio(url);
      audio.addEventListener('error', (e) => {
        console.warn(`Audio source error for ${url}:`, e);
      });
      return audio;
    };

    creakAudio.current = initAudio('https://www.soundjay.com/misc/sounds/creak-1.mp3');
    shuffleAudio.current = initAudio('https://www.soundjay.com/misc/sounds/paper-shuffle-1.mp3');
    
    if (creakAudio.current) creakAudio.current.volume = 0.4;
    if (shuffleAudio.current) shuffleAudio.current.volume = 0.3;

    // Auth listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Firestore sync - Families List
  useEffect(() => {
    if (!user) {
      setFamilies(INITIAL_FAMILIES);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'families'), (snapshot) => {
      setFamilies(prev => {
        const data: Record<string, FamilyMember> = { ...INITIAL_FAMILIES, ...prev };
        snapshot.forEach((doc) => {
          const familyData = doc.data() as FamilyMember;
          data[doc.id] = { 
            ...familyData, 
            photos: prev[doc.id]?.photos || familyData.photos || [] 
          };
        });
        return data;
      });
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Error: ", error);
      setIsLoading(false);
    });

    const unsubscribeConnections = onSnapshot(collection(db, 'connections'), (snapshot) => {
      const connData: Connection[] = [];
      snapshot.forEach((doc) => {
        connData.push({ id: doc.id, ...doc.data() } as Connection);
      });
      if (connData.length > 0) {
        setConnections(connData);
      }
    }, (error) => {
      console.error("Connections Sync Error: ", error);
    });

    return () => {
      unsubscribe();
      unsubscribeConnections();
    };
  }, [user]);

  // Firestore sync - Map Photos
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'map_photos'), (snapshot) => {
      const photos: any[] = [];
      snapshot.forEach((doc) => {
        photos.push({ id: doc.id, ...doc.data() });
      });
      photos.sort((a, b) => (a.index || 0) - (b.index || 0));
      setMapPhotos(photos);
    }, (error) => {
      console.error("Map Photos Sync Error: ", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore sync - Selected Family Photos
  useEffect(() => {
    if (!user || !selectedFamilyId) return;

    const unsubscribe = onSnapshot(collection(db, 'families', selectedFamilyId, 'photos'), (snapshot) => {
      const cloudPhotos: any[] = [];
      snapshot.forEach((doc) => {
        cloudPhotos.push(doc.data());
      });
      cloudPhotos.sort((a, b) => (a.index || 0) - (b.index || 0));

      setFamilies(prev => {
        if (!prev[selectedFamilyId]) return prev;
        
        const localPhotos = prev[selectedFamilyId].photos || [];
        
        // If cloud is empty but local has photos, and we haven't confirmed a cloud save yet,
        // we might be in a state where local data is ahead of cloud.
        // In this case, we skip the update to avoid "blank" albums.
        if (cloudPhotos.length === 0 && localPhotos.length > 0 && !lastSavedState.current.families.includes(selectedFamilyId)) {
          console.log(`Cloud photos for ${selectedFamilyId} are empty, but local has ${localPhotos.length}. Skipping sync to prevent data loss.`);
          return prev;
        }

        // Only update if data is actually different to avoid unnecessary re-renders
        if (JSON.stringify(cloudPhotos) === JSON.stringify(localPhotos)) {
          return prev;
        }

        return {
          ...prev,
          [selectedFamilyId]: { ...prev[selectedFamilyId], photos: cloudPhotos }
        };
      });
    }, (error) => {
      console.error("Photos Sync Error: ", error);
    });

    return () => unsubscribe();
  }, [user, selectedFamilyId]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentPage('home');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const compressImage = useCallback((base64: string, maxWidth = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64;
      img.onerror = () => reject(new Error("Error al cargar la imagen para compresión"));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 0.7 quality
      };
    });
  }, []);

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (!user) {
      alert("Por favor, inicia sesión para guardar tus cambios en la nube.");
      return;
    }

    if (saveStatus === 'saving') return;

    setSaveStatus('saving');
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("La operación ha tardado demasiado tiempo. Por favor, comprueba tu conexión.")), 60000) // Increased to 60s
    );

    let saveOperationPromise: Promise<void> | undefined;

    try {
      saveOperationPromise = (async () => {
        const cleanObject = (obj: any) => {
          const newObj = { ...obj };
          Object.keys(newObj).forEach(key => {
            if (newObj[key] === undefined || newObj[key] === null) delete newObj[key];
          });
          return newObj;
        };

        const currentFamiliesStr = JSON.stringify(families);
        const currentConnectionsStr = JSON.stringify(connections);
        
        // Skip if nothing changed since last successful save
        if (currentFamiliesStr === lastSavedState.current.families && 
            currentConnectionsStr === lastSavedState.current.connections) {
          console.log("No changes detected, skipping cloud save.");
          return;
        }

        const prevFamilies = lastSavedState.current.families ? JSON.parse(lastSavedState.current.families) : {};
        const prevConnections = lastSavedState.current.connections ? JSON.parse(lastSavedState.current.connections) : [];

        // Use a batch for metadata and connections to reduce network calls
        let batch = writeBatch(db);
        let operationCount = 0;

        // Save each family metadata ONLY IF CHANGED
        const familyIds = Object.keys(families);
        for (const id of familyIds) {
          const family = families[id];
          if (!family) continue;

          // Check if this specific family changed
          const familyStr = JSON.stringify(family);
          const prevFamilyStr = JSON.stringify(prevFamilies[id]);
          
          if (familyStr === prevFamilyStr) continue;

          const { photos, ...metadata } = family;
          const docData = cleanObject({
            ...metadata,
            id: metadata.id || id,
            name: metadata.name || 'Sin nombre',
            updatedAt: serverTimestamp()
          });

          batch.set(doc(db, 'families', id), docData);
          operationCount++;
          
          // Firestore batch limit is 500
          if (operationCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        }

        // Save connections ONLY IF CHANGED
        for (const conn of connections) {
          const prevConn = prevConnections.find((c: any) => c.id === conn.id);
          if (JSON.stringify(conn) === JSON.stringify(prevConn)) continue;

          batch.set(doc(db, 'connections', conn.id), cleanObject({
            ...conn,
            updatedAt: serverTimestamp()
          }));
          operationCount++;
          
          if (operationCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        }

        // Commit remaining operations in the main batch
        if (operationCount > 0) {
          await batch.commit();
        }

        // Save photos ONLY IF CHANGED
        for (const familyId of familyIds) {
          const family = families[familyId];
          if (!family || !family.photos) continue;

          const prevFamily = prevFamilies[familyId];
          const photos = family.photos;
          const prevPhotos = prevFamily?.photos || [];

          if (JSON.stringify(photos) === JSON.stringify(prevPhotos)) continue;

          // Save photos in smaller chunks
          for (let i = 0; i < photos.length; i += 5) {
            const chunk = photos.slice(i, i + 5);
            const prevChunk = prevPhotos.slice(i, i + 5);
            
            if (JSON.stringify(chunk) === JSON.stringify(prevChunk)) continue;

            const photoBatch = writeBatch(db);
            let chunkCount = 0;
            
            chunk.forEach((photo, idx) => {
              const photoId = photo.id || `photo-${i + idx}`;
              photoBatch.set(doc(db, 'families', familyId, 'photos', photoId), cleanObject({
                ...photo,
                id: photoId,
                index: i + idx
              }));
              chunkCount++;
            });
            
            if (chunkCount > 0) {
              try {
                await photoBatch.commit();
              } catch (err) {
                console.error(`Error saving photos for ${familyId}:`, err);
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        // Update last saved state on success
        lastSavedState.current = {
          families: currentFamiliesStr,
          connections: currentConnectionsStr
        };
      })();

      // Race the save operation against the timeout
      await Promise.race([saveOperationPromise, timeoutPromise]);
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      // Ensure any future rejection of saveOperationPromise is caught to avoid unhandled rejection
      if (typeof saveOperationPromise !== 'undefined' && 'catch' in saveOperationPromise) {
        saveOperationPromise.catch(err => console.warn("Background save failed after timeout/error:", err));
      }
      
      console.error('Failed to save data', e);
      setSaveStatus('error');
      
      const message = e instanceof Error ? e.message : String(e);
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('quota') || lowerMessage.includes('exhausted') || lowerMessage.includes('limit')) {
        alert("Límite de cuota excedido: Has alcanzado el límite de escritura gratuito para hoy. \n\n¡NO TE PREOCUPES! Tus datos se han guardado de forma segura en la memoria de tu navegador (Local Backup). Podrás sincronizarlos con la nube mañana.");
      } else if (lowerMessage.includes('permission') || lowerMessage.includes('insufficient')) {
        alert("Error de permisos: No tienes autorización para realizar esta operación. Asegúrate de haber iniciado sesión correctamente.");
      } else if (lowerMessage.includes('too large') || lowerMessage.includes('size')) {
        alert("Error de tamaño: Algunas imágenes son demasiado grandes para guardarse. Prueba a usar imágenes de menor resolución.");
      } else {
        alert(`Error al guardar: ${message}`);
      }
      
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const handleOpenBox = async () => {
    if (isOpening || isBoxOpen) return;
    setIsOpening(true);
    
    // Sequence:
    // 1. Gloves appear (handled by motion)
    // 2. Creak sound starts
    setTimeout(() => {
      creakAudio.current?.play().catch(e => console.warn("Creak audio play blocked or failed:", e));
    }, 1000);

    // 3. Lid opens
    setTimeout(() => {
      setIsBoxOpen(true);
      shuffleAudio.current?.play().catch(e => console.warn("Shuffle audio play blocked or failed:", e));
    }, 1500);

    // 4. Finish opening
    setTimeout(() => {
      setIsOpening(false);
    }, 3000);
  };

  const handleUpdateFamily = (id: string, updates: Partial<FamilyMember>) => {
    setFamilies(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);

  const handleAddFamily = () => {
    const id = `fam-${Date.now()}`;
    const newFamily: FamilyMember = {
      id,
      name: 'Nueva',
      role: 'Sujeto bajo observación',
      history: '',
      notes: '',
      photos: [],
      coverPhotoUrl: ''
    };
    setFamilies(prev => ({ ...prev, [id]: newFamily }));
    setSelectedFamilyId(id);
    setCurrentPage('archive');
  };

  const handleUploadPhoto = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const compressed = await compressImage(base64);
          setFamilies(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              photos: [...prev[id].photos, { id: `photo-${Date.now()}`, url: compressed, description: '' }]
            }
          }));
        } catch (error) {
          console.error("Error processing uploaded photo:", error);
          alert("Error al procesar la imagen. Por favor, inténtalo de nuevo.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadCover = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const compressed = await compressImage(base64, 800); // Cover can be smaller
          handleUpdateFamily(id, { coverPhotoUrl: compressed });
        } catch (error) {
          console.error("Error processing cover photo:", error);
          alert("Error al procesar la imagen de portada.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadMapPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const compressed = await compressImage(base64, 1600); // Map can be larger
          const photoId = `map-${Date.now()}`;
          try {
            await setDoc(doc(db, 'map_photos', photoId), {
              url: compressed,
              description: 'Mapa de relaciones',
              index: mapPhotos.length,
              updatedAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `map_photos/${photoId}`);
          }
        } catch (error) {
          console.error("Error processing map photo:", error);
          alert("Error al procesar el mapa de relaciones.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteMapPhoto = async (photoId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'map_photos', photoId));
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `map_photos/${photoId}`);
      } catch (e) {
        // handleFirestoreError throws, so we catch it here to prevent uncaught promise rejection
        console.error("Caught firestore error in handleDeleteMapPhoto:", e);
      }
    }
  };

  const handleUpdatePhotoDescription = (description: string) => {
    if (selectedFamilyId && editingPhotoIndex !== null) {
      setFamilies(prev => {
        const family = prev[selectedFamilyId];
        if (!family) return prev;
        const newPhotos = [...family.photos];
        newPhotos[editingPhotoIndex] = { ...newPhotos[editingPhotoIndex], description };
        return {
          ...prev,
          [selectedFamilyId]: { ...family, photos: newPhotos }
        };
      });
    }
  };

  const handleSetAsCover = (index: number) => {
    if (selectedFamilyId && index !== null) {
      setFamilies(prev => {
        const family = prev[selectedFamilyId];
        if (!family) return prev;
        const photo = family.photos[index];
        return {
          ...prev,
          [selectedFamilyId]: { ...family, coverPhotoUrl: photo.url }
        };
      });
      setEditingPhotoIndex(null);
    }
  };

  const handleDeletePhoto = async (index: number) => {
    if (selectedFamilyId && index !== null) {
      const family = families[selectedFamilyId];
      if (!family) return;
      const photoToDelete = family.photos[index];

      if (user && photoToDelete.id) {
        try {
          await deleteDoc(doc(db, 'families', selectedFamilyId, 'photos', photoToDelete.id));
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.DELETE, `families/${selectedFamilyId}/photos/${photoToDelete.id}`);
          } catch (e) {
            console.error("Caught firestore error in handleDeletePhoto:", e);
          }
        }
      }

      setFamilies(prev => {
        const family = prev[selectedFamilyId];
        if (!family) return prev;
        const newPhotos = family.photos.filter((_, i) => i !== index);
        
        // If the deleted photo was the cover, reset cover
        const deletedPhotoUrl = family.photos[index].url;
        const newCoverUrl = family.coverPhotoUrl === deletedPhotoUrl 
          ? (newPhotos[0]?.url || '') 
          : family.coverPhotoUrl;

        return {
          ...prev,
          [selectedFamilyId]: { 
            ...family, 
            photos: newPhotos,
            coverPhotoUrl: newCoverUrl
          }
        };
      });
      setEditingPhotoIndex(null);
    }
  };

  const handleDeleteFamily = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      try {
        await deleteDoc(doc(db, 'families', id));
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, `families/${id}`);
        } catch (e) {
          console.error("Caught firestore error in handleDeleteFamily:", e);
        }
      }
    }
    setFamilies(prev => {
      const newFamilies = { ...prev };
      delete newFamilies[id];
      return newFamilies;
    });
    if (selectedFamilyId === id) {
      setSelectedFamilyId(null);
      setCurrentPage('families');
    }
  };


  const ScatteredPhotos = ({ visible }: { visible: boolean }) => {
    const allPhotos = (Object.values(families) as FamilyMember[]).flatMap(f => f.photos.map(p => ({ ...p, familyId: f.id })));
    const getSeededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {visible && allPhotos.map((photo, i) => {
            const left = getSeededRandom(i * 123.45) * 80 + 10;
            const top = getSeededRandom(i * 543.21) * 80 + 10;
            const rotate = (getSeededRandom(i * 999.9) - 0.5) * 60;
            const scale = 0.5 + getSeededRandom(i * 77.7) * 0.5;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0, y: 100 }}
                animate={{ opacity: 1, scale: scale, y: 0 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ 
                  type: "spring",
                  damping: 12,
                  stiffness: 100,
                  delay: i * 0.03 
                }}
                style={{ 
                  left: `${left}%`, 
                  top: `${top}%`, 
                  rotate: `${rotate}deg`,
                  zIndex: Math.floor(getSeededRandom(i) * 20)
                }}
                className="absolute pointer-events-auto"
              >
                <div 
                  className="polaroid-mini w-24 cursor-pointer"
                  onClick={() => {
                    setSelectedFamilyId(photo.familyId);
                    setCurrentPage('archive');
                  }}
                >
                  <img 
                    src={photo.url} 
                    alt="Scattered" 
                    className="w-full aspect-square object-cover grayscale"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  const Nav = () => (
    <>
      <nav className="fixed top-0 left-0 w-full z-[110] flex justify-center p-6 pointer-events-none">
        <div className="bg-vintage-paper/80 backdrop-blur-sm border border-vintage-border px-6 py-3 rounded-full flex gap-8 pointer-events-auto shadow-sm">
          <button onClick={() => setCurrentPage('home')} className={cn("flex items-center gap-2 hover:text-vintage-ink transition-colors", currentPage === 'home' ? "text-vintage-ink font-bold" : "text-vintage-ink/50")}>
            <Home size={18} /> <span className="text-xs uppercase tracking-widest">Inicio</span>
          </button>
          <button onClick={() => setCurrentPage('families')} className={cn("flex items-center gap-2 hover:text-vintage-ink transition-colors", currentPage === 'families' ? "text-vintage-ink font-bold" : "text-vintage-ink/50")}>
            <Users size={18} /> <span className="text-xs uppercase tracking-widest">Familias</span>
          </button>
          <button onClick={() => setCurrentPage('map')} className={cn("flex items-center gap-2 hover:text-vintage-ink transition-colors", currentPage === 'map' ? "text-vintage-ink font-bold" : "text-vintage-ink/50")}>
            <Share2 size={18} /> <span className="text-xs uppercase tracking-widest">Mapa</span>
          </button>
          <button onClick={() => setCurrentPage('observer')} className={cn("flex items-center gap-2 hover:text-vintage-ink transition-colors", currentPage === 'observer' ? "text-vintage-ink font-bold" : "text-vintage-ink/50")}>
            <Eye size={18} /> <span className="text-xs uppercase tracking-widest">Observador</span>
          </button>
        </div>
      </nav>

      <div className="fixed top-6 right-6 z-[110] flex gap-4">
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-vintage-ink/5 rounded-full border border-vintage-border/50">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  autoSaveEnabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                )} />
                <span className="text-[10px] typewriter-text uppercase tracking-widest text-vintage-ink/60">
                  {saveStatus === 'saving' ? 'Sincronizando...' : autoSaveEnabled ? 'Sincronización Activa' : 'Sincronización Desactivada'}
                </span>
                <button 
                  onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                  className="ml-2 text-[10px] underline hover:text-vintage-ink transition-colors"
                >
                  {autoSaveEnabled ? 'Pausar' : 'Activar'}
                </button>
              </div>
              <div className="flex items-center gap-2 typewriter-text text-[10px] text-vintage-ink/50 uppercase tracking-widest">
                <User size={12} /> {user.displayName || user.email}
              </div>
            </div>
            <button 
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border transition-all duration-300 typewriter-text text-xs uppercase tracking-widest relative",
                saveStatus === 'idle' && "bg-vintage-paper border-vintage-border text-vintage-ink hover:bg-vintage-ink hover:text-vintage-paper",
                saveStatus === 'saving' && "bg-vintage-ink/10 border-vintage-border text-vintage-ink/50 cursor-wait",
                saveStatus === 'saved' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                saveStatus === 'error' && "bg-red-50 border-red-200 text-red-700"
              )}
            >
              {saveStatus === 'idle' && <><Save size={16} /> Guardar</>}
              {saveStatus === 'saving' && <><div className="w-4 h-4 border-2 border-vintage-ink/30 border-t-vintage-ink rounded-full animate-spin" /> Guardando...</>}
              {saveStatus === 'saved' && <><Check size={16} /> Guardado correctamente</>}
              {saveStatus === 'error' && <><AlertCircle size={16} /> Error al guardar</>}
              
              {saveStatus === 'error' && (
                <div className="absolute -bottom-6 right-0 text-[8px] text-red-600/60 whitespace-nowrap lowercase italic">
                  Copia local activa (Quota Exceeded)
                </div>
              )}
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-vintage-ink/30 hover:text-vintage-ink transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 bg-vintage-ink text-vintage-paper typewriter-text text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <LogIn size={16} /> Iniciar Sesión
          </button>
        )}
      </div>
    </>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vintage-paper flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-vintage-ink/10 border-t-vintage-ink rounded-full animate-spin mx-auto mb-4" />
          <p className="typewriter-text text-sm uppercase tracking-widest text-vintage-ink/40">Accediendo al archivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <Nav />
      
      <AnimatePresence>
        {editingPhotoIndex !== null && selectedFamilyId && (
          <PhotoEditModal 
            index={editingPhotoIndex} 
            familyId={selectedFamilyId} 
            families={families}
            onUpdateDescription={handleUpdatePhotoDescription}
            onSetAsCover={handleSetAsCover}
            onDelete={handleDeletePhoto}
            onClose={() => setEditingPhotoIndex(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {currentPage === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-6"
          >
            <div className="wood-box w-full max-w-5xl h-[80vh] relative flex items-center justify-center overflow-hidden">
              <ScatteredPhotos visible={isBoxOpen} />
              
              {/* Lid */}
              <motion.div 
                className="wood-lid absolute inset-0 z-40 flex items-center justify-center"
                initial={false}
                animate={{ 
                  rotateX: isBoxOpen ? -110 : 0,
                  y: isBoxOpen ? -100 : 0,
                  opacity: isBoxOpen ? 0 : 1
                }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              >
                {!isBoxOpen && !isOpening && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <h1 className="typewriter-text text-3xl md:text-4xl text-white/80 mb-8 tracking-[0.3em] uppercase">Archivo de Familias</h1>
                    <button 
                      onClick={handleOpenBox}
                      className="typewriter-text border border-white/30 text-white/50 px-8 py-3 hover:bg-white/10 hover:text-white transition-all duration-500 uppercase tracking-widest text-sm"
                    >
                      Abrir Archivo
                    </button>
                  </motion.div>
                )}
              </motion.div>

              {/* Interaction Elements */}
              <AnimatePresence>
                {isOpening && !isBoxOpen && (
                  <>
                    {/* White Gloves */}
                    <motion.div 
                      className="absolute left-[20%] top-[40%] z-50 white-glove"
                      initial={{ x: -200, opacity: 0, rotate: -20 }}
                      animate={{ x: 0, opacity: 1, rotate: 0 }}
                      exit={{ x: -200, opacity: 0 }}
                      transition={{ duration: 0.8 }}
                    >
                      <svg width="120" height="120" viewBox="0 0 24 24" fill="white" stroke="#ccc" strokeWidth="0.5">
                        <path d="M18,11V7a2,2,0,0,0-4,0v3h-1V5a2,2,0,0,0-4,0v5h-1V6a2,2,0,0,0-4,0v9a7,7,0,0,0,14,0V11Z" />
                      </svg>
                    </motion.div>
                    <motion.div 
                      className="absolute right-[20%] top-[40%] z-50 white-glove"
                      initial={{ x: 200, opacity: 0, rotate: 20 }}
                      animate={{ x: 0, opacity: 1, rotate: 0 }}
                      exit={{ x: 200, opacity: 0 }}
                      transition={{ duration: 0.8 }}
                    >
                      <svg width="120" height="120" viewBox="0 0 24 24" fill="white" stroke="#ccc" strokeWidth="0.5" style={{ transform: 'scaleX(-1)' }}>
                        <path d="M18,11V7a2,2,0,0,0-4,0v3h-1V5a2,2,0,0,0-4,0v5h-1V6a2,2,0,0,0-4,0v9a7,7,0,0,0,14,0V11Z" />
                      </svg>
                    </motion.div>

                    {/* Magnifying Glass */}
                    <motion.div 
                      className="absolute left-[45%] top-[20%] z-50 magnifying-glass"
                      initial={{ scale: 0, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                    >
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full border-8 border-yellow-700 bg-white/10 backdrop-blur-[2px] shadow-inner" />
                        <div className="absolute top-20 left-16 w-4 h-16 bg-yellow-900 rounded-b-full rotate-45 origin-top" />
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              
              {/* Internal Content (Title when open) */}
              {isBoxOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="z-20 bg-vintage-paper/80 backdrop-blur-md p-8 border border-vintage-border shadow-2xl text-center max-w-md"
                >
                  <h1 className="typewriter-text text-3xl md:text-4xl mb-2 tracking-widest uppercase">Archivo de Familias</h1>
                  <p className="typewriter-text text-sm text-vintage-ink/60 mb-8 italic">
                    Memorias encontradas
                  </p>
                  <button 
                    onClick={() => setCurrentPage('families')}
                    className="typewriter-text border border-vintage-ink px-8 py-3 hover:bg-vintage-ink hover:text-vintage-paper transition-all duration-500 uppercase tracking-widest text-xs"
                  >
                    Explorar Fichas
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {currentPage === 'families' && (
          <motion.div
            key="families"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-6xl mx-auto"
          >
            <h2 className="typewriter-text text-4xl mb-12 text-center border-b border-vintage-border pb-6">Familias</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {(Object.values(families) as FamilyMember[])
                .filter(f => ['paula', 'nacho', 'moni', 'ander', 'familia_grande', 'inaki', 'observador'].includes(f.id))
                .sort((a, b) => {
                  const endIds = ['familia_grande', 'observador'];
                  if (endIds.includes(a.id) && !endIds.includes(b.id)) return 1;
                  if (!endIds.includes(a.id) && endIds.includes(b.id)) return -1;
                  if (endIds.includes(a.id) && endIds.includes(b.id)) {
                    return endIds.indexOf(a.id) - endIds.indexOf(b.id);
                  }
                  return a.name.localeCompare(b.name);
                })
                .map((family) => (
                <motion.div
                  key={family.id}
                  whileHover={{ y: -10 }}
                  onClick={() => {
                    setSelectedFamilyId(family.id);
                    setCurrentPage('archive');
                  }}
                  className="cursor-pointer group"
                >
                  <div className="bg-white p-6 border border-vintage-border shadow-sm group-hover:shadow-xl transition-all duration-500">
                    <div className="aspect-[4/3] bg-gray-100 mb-4 overflow-hidden relative group/cover">
                      <img 
                        src={family.coverPhotoUrl || family.photos[0]?.url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='} 
                        alt={family.name} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <label 
                        className="absolute top-2 right-2 bg-vintage-ink/80 p-2 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10 hover:bg-vintage-ink"
                        onClick={(e) => e.stopPropagation()}
                        title="Cambiar portada"
                      >
                        <Upload className="text-white" size={16} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => handleUploadCover(family.id, e)}
                        />
                      </label>
                    </div>
                    <h3 className="typewriter-text text-2xl mb-2">
                      {['familia_grande', 'observador'].includes(family.id) ? '' : 'Familia '}{family.name}
                    </h3>
                    <div className="flex justify-between items-center">
                      <p className="typewriter-text text-sm text-vintage-ink/50 uppercase tracking-widest">{family.role}</p>
                      <button 
                        onClick={(e) => handleDeleteFamily(family.id, e)}
                        className="text-vintage-ink/20 hover:text-red-800 transition-colors p-1"
                        title="Eliminar expediente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {currentPage === 'archive' && selectedFamilyId && families[selectedFamilyId] && (
          <motion.div
            key="archive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto"
          >
            <button 
              onClick={() => setCurrentPage('families')}
              className="flex items-center gap-2 text-vintage-ink/50 hover:text-vintage-ink mb-12 transition-colors uppercase tracking-widest text-xs"
            >
              <ArrowLeft size={16} /> Volver a Familias
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
              <div className="lg:col-span-2 space-y-12">
                <div className="flex justify-between items-end border-b border-vintage-border pb-4">
                  <h2 className="typewriter-text text-5xl">
                    {['familia_grande', 'observador'].includes(selectedFamilyId) ? '' : 'Familia '}{families[selectedFamilyId]?.name}
                  </h2>
                  <label className="cursor-pointer flex items-center gap-2 typewriter-text text-sm border border-vintage-ink px-4 py-2 hover:bg-vintage-ink hover:text-vintage-paper transition-all">
                    <Plus size={16} /> Subir foto
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => handleUploadPhoto(selectedFamilyId, e)}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {families[selectedFamilyId]?.photos?.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      <Polaroid 
                        src={photo.url} 
                        rotation={idx % 2 === 0 ? -2 : 2}
                        caption={photo.description || `Expediente #${selectedFamilyId}-${idx + 1}`}
                        onClick={() => setEditingPhotoIndex(idx)}
                      />
                      {(families[selectedFamilyId]?.coverPhotoUrl === photo.url || (!families[selectedFamilyId]?.coverPhotoUrl && idx === 0)) && (
                        <div className="absolute top-4 right-4 bg-vintage-ink text-vintage-paper text-[10px] px-2 py-1 uppercase tracking-widest shadow-md z-10 pointer-events-none">
                          Portada
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-8 border border-vintage-border shadow-lg h-fit sticky top-32">
                <h3 className="typewriter-text text-2xl mb-8 border-b border-vintage-border pb-2">Anotaciones</h3>
                
                <div className="space-y-6">
                  <div className="mb-8">
                    <label className="typewriter-text text-xs uppercase text-vintage-ink/40 block mb-2">Foto de portada</label>
                    <div className="aspect-[4/3] bg-gray-100 border border-vintage-border mb-3 overflow-hidden relative group">
                      <img 
                        src={families[selectedFamilyId]?.coverPhotoUrl || families[selectedFamilyId]?.photos?.[0]?.url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='} 
                        alt="Cover" 
                        className="w-full h-full object-cover grayscale"
                        referrerPolicy="no-referrer"
                      />
                      <label className="absolute inset-0 bg-vintage-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Upload className="text-white mr-2" size={20} />
                        <span className="text-white typewriter-text text-xs uppercase tracking-widest">Cambiar</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => handleUploadCover(selectedFamilyId, e)}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="typewriter-text text-xs uppercase text-vintage-ink/40 block mb-1">Nombre</label>
                    <input 
                      type="text"
                      value={families[selectedFamilyId]?.name || ''}
                      onChange={(e) => handleUpdateFamily(selectedFamilyId, { name: e.target.value })}
                      className="w-full typewriter-text border-b border-vintage-border focus:border-vintage-ink outline-none py-1 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="typewriter-text text-xs uppercase text-vintage-ink/40 block mb-1">Rol en la familia</label>
                    <input 
                      type="text"
                      value={families[selectedFamilyId]?.role || ''}
                      onChange={(e) => handleUpdateFamily(selectedFamilyId, { role: e.target.value })}
                      className="w-full typewriter-text border-b border-vintage-border focus:border-vintage-ink outline-none py-1 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="typewriter-text text-xs uppercase text-vintage-ink/40 block mb-1">Historia</label>
                    <textarea 
                      rows={6}
                      value={families[selectedFamilyId]?.history || ''}
                      onChange={(e) => handleUpdateFamily(selectedFamilyId, { history: e.target.value })}
                      className="w-full typewriter-text border border-vintage-border p-3 focus:border-vintage-ink outline-none bg-transparent resize-none text-sm leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="typewriter-text text-xs uppercase text-vintage-ink/40 block mb-1">Notas</label>
                    <textarea 
                      rows={3}
                      value={families[selectedFamilyId]?.notes || ''}
                      onChange={(e) => handleUpdateFamily(selectedFamilyId, { notes: e.target.value })}
                      className="w-full typewriter-text border border-vintage-border p-3 focus:border-vintage-ink outline-none bg-transparent resize-none text-sm italic"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {currentPage === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto"
          >
            <div className="flex justify-between items-end mb-12">
              <div className="text-left">
                <h2 className="typewriter-text text-5xl mb-4">Mapa de relaciones</h2>
                <p className="typewriter-text text-vintage-ink/60 italic">Documentos y mapas del archivo familiar.</p>
              </div>
              <label className="cursor-pointer flex items-center gap-2 typewriter-text text-sm border border-vintage-ink px-4 py-2 hover:bg-vintage-ink hover:text-vintage-paper transition-all">
                <Plus size={16} /> Subir nuevo mapa
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleUploadMapPhoto}
                />
              </label>
            </div>

            <div className="space-y-12">
              {mapPhotos.length > 0 ? (
                <>
                  <h3 className="typewriter-text text-2xl mb-8 border-b border-vintage-border pb-2">Documentos Guardados</h3>
                  {mapPhotos.map((photo, idx) => (
                    <div key={photo.id} className="mb-12 bg-white p-4 border border-vintage-border shadow-xl relative group">
                      <div className="relative aspect-[16/11] overflow-hidden bg-vintage-paper">
                        <img 
                          src={photo.url} 
                          alt={`Mapa ${idx + 1}`} 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 pointer-events-none border-[20px] border-white/10" />
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <p className="typewriter-text text-[10px] text-vintage-ink/40 uppercase tracking-widest">
                          Documento del archivo - Mapa de Relaciones #{idx + 1}
                        </p>
                        <button 
                          onClick={() => handleDeleteMapPhoto(photo.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-800 hover:text-red-600"
                          title="Eliminar mapa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-20 border-2 border-dashed border-vintage-border opacity-40">
                  <p className="typewriter-text">No hay mapas cargados. Utilice el botón superior para añadir documentos.</p>
                </div>
              )}
            </div>

            <div className="p-8 border border-vintage-border bg-white/50 typewriter-text text-sm leading-relaxed">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h4 className="font-bold uppercase tracking-[0.2em] text-xs border-b border-vintage-border pb-2">Leyenda de Vínculos</h4>
                  <ul className="text-xs space-y-3 opacity-80">
                    <li><span className="font-bold">Óscar ↔ Iñaki:</span> Primos</li>
                    <li><span className="font-bold">Iñaki ↔ Lin Xia:</span> Hermanos</li>
                    <li><span className="font-bold">Óscar ↔ Alex:</span> Colegio (desde pequeños)</li>
                    <li><span className="font-bold">Óscar ↔ Carmen:</span> Residencia Madrid</li>
                    <li><span className="font-bold">Grupo ↔ Yasir:</span> Feria de Almería → Conocen a Yasir</li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold uppercase tracking-[0.2em] text-xs border-b border-vintage-border pb-2">Notas del Archivo</h4>
                  <p className="text-xs opacity-70 italic">
                    Este mapa visualiza las conexiones documentadas entre los sujetos. 
                    Las líneas punteadas representan la red social que une a las diferentes familias.
                  </p>
                  <div className="pt-4 text-[10px] uppercase tracking-widest opacity-40">
                    • Documento clasificado<br/>
                    • Las flechas indican la dirección del vínculo
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {currentPage === 'observer' && (
          <motion.div
            key="observer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="max-w-3xl mx-auto mt-20"
          >
            <div className="bg-white p-16 border border-vintage-border shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-vintage-ink/10" />
              
              <h2 className="typewriter-text text-6xl mb-12">Observador</h2>
              
              <div className="aspect-[3/4] max-w-sm mx-auto border-2 border-vintage-border mb-12 flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-vintage-paper/20 backdrop-blur-[2px] z-10" />
                <div className="typewriter-text text-vintage-ink/20 text-xl z-0">
                  Reflejo ausente
                </div>
                <div className="absolute inset-0 border-8 border-white z-20 pointer-events-none shadow-inner" />
              </div>

              <div className="space-y-6 typewriter-text">
                <p className="text-2xl italic">El observador no tiene nombre.</p>
                <p className="text-lg text-vintage-ink/60">Cada visitante que entra en este archivo ocupa ese lugar.</p>
                <div className="pt-12 border-t border-vintage-border mt-12">
                  <p className="text-xs uppercase tracking-[0.3em] text-vintage-ink/30">Usted es parte de este archivo ahora.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background elements for aesthetic */}
      <div className="fixed bottom-10 right-10 pointer-events-none opacity-20 hidden lg:block">
        <div className="typewriter-text text-[100px] leading-none select-none">
          1945<br/>2026
        </div>
      </div>
    </div>
  );
}
