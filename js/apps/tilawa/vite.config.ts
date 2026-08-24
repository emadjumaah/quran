import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * **التلاوةُ تُثبَّت فتُفتح كالمصحف** (ف٣ §٣) — على نمط مشكاة نفسِه، بثلاثة حدود:
 *
 * ١) **التخزينُ المسبَقُ خفيف**: القشرةُ (شيفرةٌ وأنماطٌ وأيقونة) · **نصُّ
 *    المصحف** · **خطُّ المصحف الافتراضيُّ وحدَه**. وما سواه لا يُفرض على أحدٍ في
 *    التثبيت: الخطّان الآخران خيارُ قارئٍ يختاره بيده، و«فروق التنزيل» مادّةُ
 *    **باب التثبيت** (ن١) تُجلب عند فتحه ثمّ تبقى، ودليلُ التلاوات يُخزَّن عند
 *    أوّل استماع.
 * ٢) **وعُدّةُ التتبّع لا تدخل التثبيت**: ٢٣ م.ب من عُدّة التشغيل لا تُنزَّل على
 *    كلّ من ثبّت مصحفًا ليقرأ — يخزّنها عاملُ الخدمة **عند أوّل تشغيلٍ للتتبّع**
 *    بقاعدة `sawt-runtime`، فتعمل بعدها بلا اتّصال. (والنموذجُ نفسُه يخزّنه
 *    المحرّكُ في خزانة المتصفّح لا ههنا.)
 * ٣) **ولا تلاوةً مسموعةً في عامل الخدمة**: صوتُ القارئ يُخدَم من مرآتنا بمدى
 *    البايتات (Range)، واعتراضُه يكسره على أجهزة آبل — وهو درسٌ مقيَّدٌ في مشكاة
 *    بحرفه، فلا يُعاد اكتشافُه ههنا.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mushaf-text.json", "fonts/amiri-quran.woff2"],
      manifest: {
        name: "التلاوة",
        short_name: "التلاوة",
        description: "مصحفٌ يُقرأ ويُستمع إليه، ويُسمَّع عليه الوردُ فيجري المؤشّرُ مع صوتك.",
        dir: "rtl",
        lang: "ar",
        id: "/",
        categories: ["education", "books", "lifestyle"],
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        /* **أخضرُ الهويّة** (م٣ §١) — وهو لونُ المؤسسة في مشكاة نفسِه: يصبغ
           شاشةَ الإقلاع التي يرسمها النظامُ وبطاقةَ التطبيق في مبدِّل المهامّ.
           **ولا ينازع ميثاقَ الوجه §١١**: `theme-color` في الوسم هو الذي يوافق
           خلفيّةَ الوضع ويتبدّل معه، وهذا وسمُ هويّةٍ لا وسمُ صفحة. */
        theme_color: "#0b6e56",
        background_color: "#f7f4ee",
        /* **نقطيّاتٌ لا SVG**: ما يُثبَّت على الأجهزة يقرؤه نظامُها لا متصفّحُنا
           — وأندرويدُ يطلب ١٩٢ و٥١٢ ومقنَّعةً، وآبلُ لا تعرف SVG في أيقونتها.
           ومصدرُها كلِّها `icons/icon.svg` المكتوبةُ بأيدينا. */
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
        /* ما لا يُفرض في التثبيت: عُدّةُ التتبّع، والخطّان الاختياريّان، ومادّةُ
           المفارق (تُخزَّن عند أوّل فتحٍ لباب التثبيت)، ودليلُ التلاوات. */
        globIgnores: [
          "**/ort-wasm-*.wasm",
          "**/asrWorker-*.js",
          "**/ort/**",
          "**/fonts/kfgqpc-hafs.woff2",
          "**/fonts/scheherazade.woff2",
          "**/furuq.json",
          "**/audio-manifest.json",
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        runtimeCaching: [
          {
            // عُدّةُ تشغيل المحرّك الحرّ — عند أوّل تشغيلٍ للتتبّع لا عند التثبيت
            urlPattern: /(ort-wasm-[^/]*\.(wasm|mjs)|asrWorker-[^/]*\.js)(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "sawt-runtime",
              expiration: { maxEntries: 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // دليلُ التلاوات وما يجري مجراه — عند أوّل استعمالٍ لبابه
            urlPattern: /\/[^/]+\.json(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "tilawa-json",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
