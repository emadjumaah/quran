import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** هيكلُ «التلاوة» الأدنى (ف١): يبني ويُعرض ولا واجهةَ فيه بعد.
 *  ولا تثبيتَ (PWA) ولا مصحفَ ولا تتبّع — تلك ف٢ وف٣. */
export default defineConfig({
  plugins: [react()],
});
