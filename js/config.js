/* =========================================================
   إعدادات اللعبة — هذا الملف الوحيد اللي تحتاج تعدّل فيه
   ========================================================= */

/* 1) Firebase (للعب أونلاين بين الأجهزة) */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCnNu1wF5T0ly7j5dgrRvYaKtEg9hpWto4",
  authDomain: "drawchaos-4789d.firebaseapp.com",
  databaseURL: "https://drawchaos-4789d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "drawchaos-4789d",
  appId: "1:556304692626:web:c3b0bad2904d2e53947d4b"
};

/* 2) الإعلانات (Google AdSense — H5 Games Ads)
   - publisherId: رقم الناشر من AdSense بالشكل ca-pub-1234567890123456
   - testMode: خله true لين تتأكد إن كل شي شغال، بعدين حطه false
   - simulate: يطلع "إعلان تجريبي" وهمي لما ما يكون عندك publisherId
   - betweenTurnsEvery: إعلان إضافي كل كم دور (0 = بدون) */
window.ADS_CONFIG = {
  publisherId: "",
  testMode: true,
  simulate: false,
  betweenTurnsEvery: 0,
  frequencyHint: "30s"
};