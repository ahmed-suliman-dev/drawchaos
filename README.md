# 🎨 ارسم وخمّن — دليل التشغيل والنشر

لعبة رسم وتخمين جماعية أونلاين (2 إلى 8 لاعبين) بغرف ورابط دعوة، تحديات للرسام، تخريب، وإعلانات جوجل.

---

## 📁 الملفات

| الملف | وش فيه |
|---|---|
| `index.html` | الصفحة الرئيسية واللعبة + محتوى نصي يساعد في جوجل |
| `js/config.js` | **الملف الوحيد اللي تعدّل فيه**: إعدادات Firebase والإعلانات |
| `js/game.js` | منطق اللعبة كامل |
| `js/net.js` | الاتصال (Firebase أو وضع التجربة) |
| `js/ads.js` | الإعلانات (H5 Games Ads) |
| `js/words.js` | الكلمات (تقدر تضيف عليها) |
| `privacy.html` / `about.html` | سياسة الخصوصية وعن اللعبة (لازمة لقبول AdSense) |
| `ads.txt` | ملف إثبات الإعلانات |
| `database.rules.json` | قواعد حماية قاعدة البيانات |

---

## 🧪 تجربة سريعة بدون أي إعداد

افتح `index.html` من سيرفر محلي (أو بعد ما ترفعه على Netlify)، سوّ غرفة، وانسخ الرابط في **تبويب ثاني بنفس المتصفح**. هذا "وضع التجربة" ويشتغل بس بين تبويبات نفس المتصفح. للعب بين جوالات مختلفة كمّل الخطوة 1.

---

## 1️⃣ Firebase (للعب أونلاين بين الجوالات) — مجاني

1. ادخل [console.firebase.google.com](https://console.firebase.google.com) وسوّ مشروع جديد.
2. من القائمة: **Build ← Authentication ← Get started ← Sign-in method ← Anonymous ← Enable**.
3. **Build ← Realtime Database ← Create database** (اختر أقرب موقع، مثل `europe-west1`) ← ابدأ بـ **Locked mode**.
4. في تبويب **Rules** امسح الموجود والصق محتوى ملف `database.rules.json` واضغط **Publish**.
5. ⚙️ **Project settings ← Your apps ← أيقونة الويب `</>`** ← سجّل التطبيق، وانسخ قيم `firebaseConfig`.
6. الصقها في `js/config.js` داخل `FIREBASE_CONFIG`، وتأكد إن `databaseURL` موجود.
7. بعد ما تنشر الموقع: **Authentication ← Settings ← Authorized domains** وأضف دومينك (مثل `yourgame.com` و `yourgame.netlify.app`).

> الخطة المجانية (Spark) تكفي مئات القيمات يومياً. الرسمات تنمسح كل دور فالاستهلاك قليل.

---

## 2️⃣ GitHub

1. سوّ حساب في [github.com](https://github.com) ← **New repository** (مثلاً `rasm-game`).
2. اضغط **uploading an existing file** واسحب كل الملفات والمجلدات (`css`, `js`, وكل الملفات) ← **Commit changes**.

## 3️⃣ Netlify

1. ادخل [netlify.com](https://netlify.com) بحساب GitHub.
2. **Add new site ← Import an existing project ← GitHub** واختر المستودع.
3. اترك الإعدادات زي ما هي (ما فيه Build command) ← **Deploy**.
4. كل ما عدّلت شي في GitHub، Netlify ينشره تلقائياً.

### الدومين (ينصح فيه)
- اشترِ دومين (10–15$ بالسنة) من Namecheap أو Porkbun أو من Netlify نفسه.
- في Netlify: **Domain management ← Add a domain** واتبع الخطوات.
- بعدها عدّل `YOUR-DOMAIN.com` في `robots.txt` و `sitemap.xml`.

## 4️⃣ Google Search Console

1. ادخل [search.google.com/search-console](https://search.google.com/search-console) ← **Add property ← Domain** واكتب دومينك.
2. أضف سجل TXT اللي يعطيك إياه في إعدادات الـ DNS (في Netlify: Domain ← DNS settings ← Add record).
3. بعد التحقق: **Sitemaps** ← اكتب `sitemap.xml` ← Submit.

## 5️⃣ الإعلانات (AdSense + H5 Games Ads)

1. قبل التقديم: حط بريدك بدل `YOUR-EMAIL@example.com` في `privacy.html` و `about.html`.
2. خل الموقع يشتغل كم أسبوع ويجيه زوار.
3. قدّم في [adsense.google.com](https://adsense.google.com) وأضف موقعك.
4. بعد القبول خذ رقم الناشر (`ca-pub-xxxxxxxxxxxxxxxx`):
   - حطه في `js/config.js` ← `publisherId`.
   - في `ads.txt` بدّل `pub-0000000000000000` برقمك (بدون `ca-`).
5. قدّم على **H5 Games Ads** (من نفس AdSense، أو من صفحة [H5 Games Ads](https://adsense.google.com/start/h5-games-ads/)) لأن إعلانات الألعاب تحتاج موافقة خاصة.
6. جرّب والإعدادات `testMode: true`، ولما يشتغل كل شي غيّرها لـ `false`.

### أماكن الإعلانات في اللعبة
- **قبل القيم:** إعلان وهم في غرفة الانتظار ينتظرون الباقين.
- **بعد القيم:** إعلان في شاشة النتائج النهائية.
- **إعلان بمكافأة:** "شاهد إعلان = +1 تخريب" (في غرفة الانتظار، بين الأدوار، وبعد القيم). ما فيه أي إعلان وقت الرسم.
- تقدر تضيف إعلان بين الأدوار من `betweenTurnsEvery` في `config.js` (مثلاً 3 = إعلان كل 3 أدوار).

---

## ✏️ تعديلات سهلة

- **إضافة كلمات:** في `js/words.js` أضف `"الكلمة|طريقة كتابة ثانية"`.
- **وقت اختيار الكلمة / النتائج / حد التخريب:** في أول `js/game.js` (`CHOOSE_MS`, `RESULTS_MS`, `MAX_SAB_PER_TURN`).
- **التحديات وأنواع التخريب:** مصفوفة `TWISTS` و `SABS` في أول `js/game.js`.
