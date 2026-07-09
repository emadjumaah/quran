-- ============================================================
-- Example queries for quran-kg.db  (sqlite3 quran-kg.db < ...)
-- Run interactively:  sqlite3 -box quran-kg.db
-- ============================================================

-- 1. Everything about one word (e.g. 2:255 word 5) — segments fully decoded.
SELECT seg_id, text, role, pos_ar, pos_en, root_ar, lemma_ar,
       aspect, mood, voice, case_mark, person, gender, number
FROM v_segment WHERE surah_no = 2 AND ayah_no = 255 AND word_no = 5;

-- 2. The 20 most frequent roots in the Quran.
SELECT root_ar, occurrences, distinct_lemmas, surah_spread
FROM v_root_freq LIMIT 20;

-- 3. Every occurrence of the root رحم — the "root map".
SELECT location, word, pos, derivation, verb_form
FROM v_root_map WHERE root_ar = 'رحم' ORDER BY surah_no, ayah_no, word_no;

-- 4. All distinct derived forms (lemmas) of the root علم, with counts.
SELECT l.lemma_ar, l.occurrences
FROM lemma l JOIN root r ON r.root_id = l.root_id
WHERE r.root_ar = 'علم' ORDER BY l.occurrences DESC;

-- 5. Ayahs where mercy (رحم) and punishment (عذب) co-occur.
SELECT DISTINCT a.location, a.text_clean
FROM ayah a
JOIN segment s1 ON s1.ayah_id = a.ayah_id
JOIN root r1    ON r1.root_id = s1.root_id AND r1.root_ar = 'رحم'
JOIN segment s2 ON s2.ayah_id = a.ayah_id
JOIN root r2    ON r2.root_id = s2.root_id AND r2.root_ar = 'عذب'
ORDER BY a.ayah_id;

-- 6. Root frequency: Meccan vs Medinan surahs (e.g. قتل).
SELECT s.revelation, COUNT(*) AS occurrences
FROM segment g
JOIN root r ON r.root_id = g.root_id AND r.root_ar = 'قتل'
JOIN word w ON w.word_id = g.word_id
JOIN surah s ON s.surah_no = w.surah_no
GROUP BY s.revelation;

-- 7. Distribution of verb forms (I–XII) across the whole Quran.
SELECT verb_form, COUNT(*) AS n FROM segment
WHERE verb_form IS NOT NULL AND pos = 'V'
GROUP BY verb_form ORDER BY verb_form;

-- 8. All passive-voice verbs in Surah Yusuf (12).
SELECT g.location, w.text_uthmani, r.root_ar, g.aspect
FROM segment g
JOIN word w ON w.word_id = g.word_id
LEFT JOIN root r ON r.root_id = g.root_id
WHERE g.voice = 'PASS' AND w.surah_no = 12;

-- 9. Longest ayahs by word count.
SELECT location, word_count, substr(text_clean, 1, 60) || '…' AS start
FROM ayah ORDER BY word_count DESC LIMIT 10;

-- 10. Letter frequency over the entire text (bare/clean letters).
SELECT * FROM v_letter_freq;

-- 11. Words that occur exactly once in the Quran (hapax legomena), by clean text.
SELECT text_clean, MIN(location) AS location
FROM word WHERE text_clean IS NOT NULL
GROUP BY text_clean HAVING COUNT(*) = 1
ORDER BY location LIMIT 30;

-- 12. The muqatta'at (Quranic initials) and where they open surahs.
SELECT g.location, g.text FROM segment g WHERE g.pos = 'INL';

-- 13. Per-surah linguistic profile.
SELECT * FROM v_surah_stats ORDER BY surah_no LIMIT 20;

-- 14. Vocabulary richness: distinct roots per 1000 words, by surah.
SELECT surah_no, name_translit, revelation,
       ROUND(1000.0 * distinct_roots / word_count, 1) AS roots_per_1000_words
FROM v_surah_stats ORDER BY roots_per_1000_words DESC LIMIT 15;

-- 15. Root co-occurrence network edges (top 30 pairs sharing an ayah).
SELECT r1.root_ar AS root_a, r2.root_ar AS root_b, COUNT(DISTINCT s1.ayah_id) AS shared_ayahs
FROM segment s1
JOIN segment s2 ON s2.ayah_id = s1.ayah_id AND s2.root_id > s1.root_id
JOIN root r1 ON r1.root_id = s1.root_id
JOIN root r2 ON r2.root_id = s2.root_id
GROUP BY s1.root_id, s2.root_id
ORDER BY shared_ayahs DESC LIMIT 30;

-- 16. Every sajda location with its surah.
SELECT a.location, s.name_ar, a.sajda_type
FROM ayah a JOIN surah s ON s.surah_no = a.surah_no
WHERE a.sajda_type IS NOT NULL;

-- 17. Full grammatical trace of an entire ayah (1:5).
SELECT g.location, g.text, g.role, g.pos_ar, g.root_ar, g.lemma_ar,
       g.aspect, g.case_mark, g.person, g.gender, g.number
FROM v_segment g WHERE g.surah_no = 1 AND g.ayah_no = 5
ORDER BY g.word_no, g.seg_id;

-- 18. Which juz is each surah mostly in, and page ranges.
SELECT surah_no, MIN(page) AS first_page, MAX(page) AS last_page,
       MIN(juz) AS first_juz, MAX(juz) AS last_juz
FROM ayah GROUP BY surah_no LIMIT 20;
