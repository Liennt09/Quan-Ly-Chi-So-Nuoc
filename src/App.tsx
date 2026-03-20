import React, { useState, useEffect, Suspense, lazy } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, serverTimestamp, Timestamp, getDocFromServer 
} from 'firebase/firestore';
import { Area, SubLocation, Meter, Reading, Reporter } from './types';
import Layout from './components/Layout';
import Loading from './components/Loading';
import { Droplets, LogIn } from 'lucide-react';

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
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Lazy load tabs
const Dashboard = lazy(() => import('./components/Dashboard'));
const DataEntry = lazy(() => import('./components/DataEntry'));
const History = lazy(() => import('./components/History'));
const Settings = lazy(() => import('./components/Settings'));

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data state
  const [areas, setAreas] = useState<Area[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubs = [
      onSnapshot(collection(db, 'areas'), (s) => setAreas(s.docs.map(d => ({ id: d.id, ...d.data() } as Area))), (err) => handleFirestoreError(err, OperationType.LIST, 'areas')),
      onSnapshot(collection(db, 'sub_locations'), (s) => setSubLocations(s.docs.map(d => ({ id: d.id, ...d.data() } as SubLocation))), (err) => handleFirestoreError(err, OperationType.LIST, 'sub_locations')),
      onSnapshot(collection(db, 'meters'), (s) => setMeters(s.docs.map(d => ({ id: d.id, ...d.data() } as Meter))), (err) => handleFirestoreError(err, OperationType.LIST, 'meters')),
      onSnapshot(collection(db, 'reporters'), (s) => setReporters(s.docs.map(d => ({ id: d.id, ...d.data() } as Reporter))), (err) => handleFirestoreError(err, OperationType.LIST, 'reporters')),
      onSnapshot(query(collection(db, 'readings'), orderBy('recordDate', 'desc')), (s) => {
        setReadings(s.docs.map(d => ({ id: d.id, ...d.data() } as Reading)));
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'readings');
        setLoading(false);
      }),
    ];

    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubs.forEach(u => u());
  }, [user]);

  const handleSaveReading = async (data: any) => {
    const { id, ...rest } = data;
    try {
      let savedId = id;
      if (id) {
        await updateDoc(doc(db, 'readings', id), { ...rest, updatedAt: serverTimestamp() });
      } else {
        const docRef = await addDoc(collection(db, 'readings'), { ...rest, createdAt: serverTimestamp() });
        savedId = docRef.id;
      }

      // Cascading update: find the next reading for this meter and update its usage
      const nextReading = readings
        .filter(r => r.meterId === rest.meterId && r.recordDate > rest.recordDate)
        .sort((a, b) => a.recordDate.localeCompare(b.recordDate))[0];

      if (nextReading) {
        const meter = meters.find(m => m.id === rest.meterId);
        const diff = nextReading.meterReading - rest.meterReading;
        let newUsage = Math.max(0, diff);
        
        // Handle special meters
        const specialMeters = ['Debay', 'ĐH Đập Mới 1', 'ĐH Đập Mới 2'];
        if (meter && specialMeters.includes(meter.name)) {
          newUsage = newUsage * 10;
        }

        if (newUsage !== nextReading.usage) {
          await updateDoc(doc(db, 'readings', nextReading.id), { 
            usage: newUsage, 
            updatedAt: serverTimestamp(),
            note: (nextReading.note || '') + ` (Tự động cập nhật tiêu thụ do thay đổi chỉ số ngày ${rest.recordDate})`
          });
          // Note: We could recursively update the next one, but usually one step is enough for this logic
        }
      }
    } catch (err) {
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'readings');
    }
  };

  const handleDeleteReading = async (id: string) => {
    const readingToDelete = readings.find(r => r.id === id);
    try {
      await deleteDoc(doc(db, 'readings', id));

      // If we delete a reading, the next one's usage needs to be recalculated based on the one BEFORE the deleted one
      if (readingToDelete) {
        const nextReading = readings
          .filter(r => r.meterId === readingToDelete.meterId && r.recordDate > readingToDelete.recordDate)
          .sort((a, b) => a.recordDate.localeCompare(b.recordDate))[0];

        if (nextReading) {
          const prevReading = readings
            .filter(r => r.meterId === readingToDelete.meterId && r.recordDate < readingToDelete.recordDate)
            .sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0];

          const meter = meters.find(m => m.id === readingToDelete.meterId);
          const prevVal = prevReading ? prevReading.meterReading : 0;
          const diff = nextReading.meterReading - prevVal;
          let newUsage = Math.max(0, diff);

          const specialMeters = ['Debay', 'ĐH Đập Mới 1', 'ĐH Đập Mới 2'];
          if (meter && specialMeters.includes(meter.name)) {
            newUsage = newUsage * 10;
          }

          await updateDoc(doc(db, 'readings', nextReading.id), { 
            usage: newUsage, 
            updatedAt: serverTimestamp(),
            note: (nextReading.note || '') + ` (Tự động cập nhật tiêu thụ do xóa chỉ số ngày ${readingToDelete.recordDate})`
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `readings/${id}`);
    }
  };

  const handleAddSetting = async (coll: string, data: any) => {
    try {
      await addDoc(collection(db, coll), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, coll);
    }
  };

  const handleUpdateSetting = async (coll: string, id: string, data: any) => {
    try {
      await updateDoc(doc(db, coll, id), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${coll}/${id}`);
    }
  };

  const handleDeleteSetting = async (coll: string, id: string) => {
    try {
      await deleteDoc(doc(db, coll, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${coll}/${id}`);
    }
  };

  if (!authReady) return <Loading />;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-blue-100 border border-slate-100 overflow-hidden">
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 mb-8">
              <Droplets size={48} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Quản Lý Nước</h1>
            <p className="text-slate-500 font-medium mb-10">Hệ thống quản lý khai thác và tiêu thụ nước thông minh</p>
            
            <button
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Đăng nhập với Google
            </button>
            
            <p className="mt-8 text-xs text-slate-400 font-medium">
              Bằng cách đăng nhập, bạn đồng ý với các điều khoản sử dụng của chúng tôi.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={user}>
      <Suspense fallback={<Loading />}>
        {loading ? <Loading /> : (
          <>
            {activeTab === 'dashboard' && <Dashboard areas={areas} subLocations={subLocations} meters={meters} readings={readings} />}
            {activeTab === 'entry' && (
              <DataEntry 
                areas={areas} 
                subLocations={subLocations} 
                meters={meters} 
                reporters={reporters} 
                readings={readings} 
                onSave={handleSaveReading}
                onDelete={handleDeleteReading}
                user={user}
              />
            )}
            {activeTab === 'history' && (
              <History 
                areas={areas} 
                subLocations={subLocations} 
                meters={meters} 
                reporters={reporters} 
                readings={readings} 
                onDelete={handleDeleteReading}
                onEdit={(r) => {
                  // Simple edit: switch to entry tab and pre-fill
                  // In a real app, we'd use a state for editingReading
                  setActiveTab('entry');
                }}
              />
            )}
            {activeTab === 'settings' && (
              <Settings 
                areas={areas} 
                subLocations={subLocations} 
                meters={meters} 
                reporters={reporters} 
                readings={readings}
                onAdd={handleAddSetting}
                onDelete={handleDeleteSetting}
                onUpdate={handleUpdateSetting}
              />
            )}
          </>
        )}
      </Suspense>
    </Layout>
  );
}
