/**
 * شارةُ الدرجة — اللغةُ البصريّةُ الخماسيّةُ الواحدةُ في الباب كلِّه.
 * اسمُ الدرجة وشرحُها منقولان حرفًا: الاسمُ من v1، والشرحُ من الميثاق §٣.
 */
import type { TarikhGrade } from "../lib/tarikhData";
import type { GradeId } from "../lib/tarikhTheme";

export default function GradeChip({ grade, grades }: { grade: GradeId; grades: TarikhGrade[] }) {
  const g = grades.find((x) => x.id === grade);
  if (!g) return null;
  return <span className={`gchip g-${grade}`} title={g.gloss}>{g.label}</span>;
}
