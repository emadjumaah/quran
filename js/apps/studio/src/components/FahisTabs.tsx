/** أبوابُ «ميزان الأقوال» الثلاثة — شريطٌ واحدٌ ثابتٌ في رأس كلِّ صفحةٍ من القسم. */
import { NavLink } from "react-router-dom";

const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "on" : "");

export default function FahisTabs() {
  return (
    <nav className="ftabs" aria-label="أبواب القسم">
      <NavLink to="/fahis" end className={cls}>في الميزان</NavLink>
      <NavLink to="/fahis/tool" className={cls}>زِنْ قولًا</NavLink>
      <NavLink to="/fahis/method" className={cls}>المنهجُ والمراجع</NavLink>
    </nav>
  );
}
