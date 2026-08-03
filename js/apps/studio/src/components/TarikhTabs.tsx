/** أبوابُ القسم الثلاثة — على نمط تبويب «ميزان الأقوال»، مدخلٌ واحدٌ لا تشتيت. */
import { NavLink, useLocation } from "react-router-dom";

const TABS: [to: string, label: string][] = [
  ["/tarikh", "الدعاوى الثماني"],
  ["/tarikh/masadir", "المصادر والمنهج"],
  ["/tarikh/wathiqa", "الوثيقةُ كاملةً"],
];

export default function TarikhTabs() {
  const loc = useLocation();
  return (
    <div className="ttabs">
      {TABS.map(([to, label]) => {
        const on = to === "/tarikh"
          ? loc.pathname === "/tarikh" || loc.pathname.startsWith("/tarikh/d/")
          : loc.pathname.startsWith(to);
        return <NavLink key={to} to={to} className={on ? "on" : undefined}>{label}</NavLink>;
      })}
    </div>
  );
}
