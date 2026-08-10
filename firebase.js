import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2z-ZgCSGEDm4IaUDLYM4XM4kTGs89TRM",
  authDomain: "kas-bersama-fd793.firebaseapp.com",
  projectId: "kas-bersama-fd793",
  storageBucket: "kas-bersama-fd793.firebasestorage.app",
  messagingSenderId: "592304723834",
  appId: "1:592304723834:web:4a9be3cf28fb0ed616a8c3",
  measurementId: "G-FDP5CYMX18"
};

const app = initializeApp(firebaseConfig);
const dbStore = getFirestore(app);

window.cachedDB = {
  settings: { groupName: 'Kas Bareng', amount: 20000, qrisName: '', qrisImage: null, adminPassword: 'admin', groqKey: '' },
  members: [],
  payments: {}
};

window.isDBLoaded = false;
let loadCount = 0;

function checkLoad() {
  loadCount++;
  // We wait for 3 listeners to fire at least once (settings, members, payments)
  if (loadCount >= 3 && !window.isDBLoaded) {
    window.isDBLoaded = true;
    
    // Auto-migrate from localStorage if Firestore is empty
    const local = localStorage.getItem('kasbareng_v2');
    if (local && window.cachedDB.members.length === 0) {
      try {
        const localDB = JSON.parse(local);
        if (localDB.members && localDB.members.length > 0) {
          console.log("Migrating from localStorage to Firebase...");
          window.saveDB(localDB);
        }
      } catch(e) {}
    }

    if (window.initApp) window.initApp();
  } else if (window.isDBLoaded && window.onDBUpdate) {
    window.onDBUpdate();
  }
}

// Listen to settings
onSnapshot(doc(dbStore, "kasbareng", "settings"), (docSnap) => {
  if (docSnap.exists()) {
    window.cachedDB.settings = Object.assign(window.cachedDB.settings, docSnap.data());
  }
  checkLoad();
});

// Listen to members
onSnapshot(doc(dbStore, "kasbareng", "members"), (docSnap) => {
  if (docSnap.exists()) {
    window.cachedDB.members = docSnap.data().list || [];
  }
  checkLoad();
});

// Listen to payments
onSnapshot(collection(dbStore, "kasbareng_payments"), (snapshot) => {
  window.cachedDB.payments = {};
  snapshot.forEach((docSnap) => {
    window.cachedDB.payments[docSnap.id] = docSnap.data();
  });
  checkLoad();
});

// Global functions for compatibility with old codebase
window.loadDB = function() {
  return window.cachedDB;
}

window.saveDB = async function(newDB) {
  // Optimistic UI update
  window.cachedDB = newDB; 
  if (window.onDBUpdate) window.onDBUpdate();
  
  try {
    // Save settings
    await setDoc(doc(dbStore, "kasbareng", "settings"), newDB.settings);
    
    // Save members
    await setDoc(doc(dbStore, "kasbareng", "members"), { list: newDB.members });
    
    // Save payments
    const batch = writeBatch(dbStore);
    for (const [payKey, payData] of Object.entries(newDB.payments)) {
      const payRef = doc(dbStore, "kasbareng_payments", payKey);
      batch.set(payRef, payData);
    }
    
    // Delete payments that were removed
    const allPays = await getDocs(collection(dbStore, "kasbareng_payments"));
    allPays.forEach((d) => {
      if (!newDB.payments[d.id]) {
        batch.delete(d.ref);
      }
    });
    
    await batch.commit();
  } catch (err) {
    console.error("Firebase Save Error:", err);
    if (window.showToast) window.showToast("Gagal menyimpan ke database server!", "error");
  }
}
