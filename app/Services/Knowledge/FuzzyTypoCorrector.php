<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeChunk;
use App\Models\KnowledgeDocument;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Fuzzy typo correction without manual typo pairs.
 *
 * Two layers:
 * 1) Base lexicon — always on, survives knowledge base replacement
 * 2) Dynamic lexicon — words from current knowledge (titles + chunks)
 *
 * When knowledge is replaced, dynamic words change, but base correction
 * (layanan, alamat, lokasi, kontak, dll.) remains available.
 */
class FuzzyTypoCorrector
{
    public const CACHE_PREFIX = 'deka_fuzzy_typo_vocabulary_v2:';

    /**
     * @param  array<int, string>|null  $vocabulary
     */
    public function __construct(
        private ?array $vocabulary = null,
        private readonly float $minSimilarity = 0.55,
        private readonly int $maxDistance = 3,
    ) {}

    public function correct(string $text): string
    {
        $tokens = preg_split('/(\s+)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE);

        if ($tokens === false) {
            return $text;
        }

        $vocabulary = $this->vocabulary();

        if ($vocabulary === []) {
            return $text;
        }

        $corrected = [];

        foreach ($tokens as $token) {
            if (preg_match('/^\s+$/u', $token) === 1) {
                $corrected[] = $token;

                continue;
            }

            $corrected[] = $this->correctToken($token, $vocabulary);
        }

        return implode('', $corrected);
    }

    /**
     * @return array<string, string> original => corrected (only changed tokens)
     */
    public function corrections(string $text): array
    {
        $originalTokens = preg_split('/\s+/u', trim($text)) ?: [];
        $correctedText = $this->correct($text);
        $correctedTokens = preg_split('/\s+/u', trim($correctedText)) ?: [];
        $map = [];

        foreach ($originalTokens as $index => $original) {
            $corrected = $correctedTokens[$index] ?? $original;

            if (mb_strtolower($original) !== mb_strtolower($corrected)) {
                $map[$original] = $corrected;
            }
        }

        return $map;
    }

    public static function flushVocabularyCache(): void
    {
        try {
            // Forget known fingerprint keys is hard; store latest key pointer.
            $latest = Cache::get(self::CACHE_PREFIX.'latest');

            if (is_string($latest) && $latest !== '') {
                Cache::forget($latest);
            }

            Cache::forget(self::CACHE_PREFIX.'latest');
            // Legacy v1 key
            Cache::forget('deka_fuzzy_typo_vocabulary_v1');
        } catch (Throwable) {
            // Ignore cache backend issues.
        }
    }

    /**
     * @param  array<string, true>  $vocabulary
     */
    private function correctToken(string $token, array $vocabulary): string
    {
        if (preg_match('/^[\p{L}\p{N}][\p{L}\p{N}\'\-]{2,}$/u', $token) !== 1) {
            return $token;
        }

        $lower = mb_strtolower($token);

        if ($this->isStopword($lower) || isset($vocabulary[$lower])) {
            return $token;
        }

        if (mb_strlen($lower) < 4) {
            return $token;
        }

        $match = $this->bestMatch($lower, $vocabulary);

        if ($match === null) {
            return $token;
        }

        return $this->preserveCasing($token, $match);
    }

    /**
     * @param  array<string, true>  $vocabulary
     */
    private function bestMatch(string $token, array $vocabulary): ?string
    {
        $tokenLength = mb_strlen($token);
        $bestWord = null;
        $bestScore = 0.0;

        foreach (array_keys($vocabulary) as $candidate) {
            $candidateLength = mb_strlen($candidate);
            $lengthDiff = abs($tokenLength - $candidateLength);

            if ($lengthDiff > $this->maxDistance) {
                continue;
            }

            if ($tokenLength >= 5 && mb_substr($token, 0, 1) !== mb_substr($candidate, 0, 1)) {
                continue;
            }

            $asciiToken = $this->ascii($token);
            $asciiCandidate = $this->ascii($candidate);

            if ($asciiToken === '' || $asciiCandidate === '') {
                continue;
            }

            $distance = levenshtein(
                substr($asciiToken, 0, 255),
                substr($asciiCandidate, 0, 255),
            );

            if ($distance > $this->maxDistance) {
                continue;
            }

            $maxLen = max(strlen($asciiToken), strlen($asciiCandidate), 1);
            $score = 1 - ($distance / $maxLen);

            $accepted = $distance <= 1
                || ($distance === 2 && $score >= 0.60)
                || ($distance === 3 && $score >= $this->minSimilarity && $tokenLength >= 6);

            if (! $accepted) {
                continue;
            }

            $rank = (100 - $distance) + $score;

            // Prefer base-lexicon style short domain words slightly for stability
            // when distances are equal (avoids random long KB tokens winning).
            if ($candidateLength <= 14) {
                $rank += 0.05;
            }

            if ($rank > $bestScore) {
                $bestScore = $rank;
                $bestWord = $candidate;
            }
        }

        return $bestWord;
    }

    /**
     * @return array<string, true>
     */
    private function vocabulary(): array
    {
        if ($this->vocabulary !== null) {
            return $this->indexed($this->vocabulary);
        }

        try {
            $fingerprint = $this->knowledgeFingerprint();
            $cacheKey = self::CACHE_PREFIX.$fingerprint;

            $words = Cache::remember($cacheKey, now()->addHours(12), function () use ($cacheKey): array {
                Cache::forever(self::CACHE_PREFIX.'latest', $cacheKey);

                return $this->buildLayeredVocabulary();
            });
        } catch (Throwable) {
            $words = $this->baseLexicon();
        }

        $this->vocabulary = $words;

        return $this->indexed($words);
    }

    /**
     * Base (stable) + dynamic (current knowledge). Dynamic never removes base.
     *
     * @return array<int, string>
     */
    private function buildLayeredVocabulary(): array
    {
        $words = [
            ...$this->baseLexicon(),
            ...$this->dynamicKnowledgeLexicon(),
        ];

        $words = array_values(array_unique($words));

        if (count($words) > 12000) {
            // Keep full base lexicon, trim only the overflow dynamic tail.
            $base = $this->baseLexicon();
            $dynamic = array_values(array_diff($words, $base));
            $dynamic = array_slice($dynamic, 0, max(0, 12000 - count($base)));
            $words = array_values(array_unique([...$base, ...$dynamic]));
        }

        return $words;
    }

    /**
     * @return array<int, string>
     */
    private function dynamicKnowledgeLexicon(): array
    {
        $words = [];

        try {
            if (class_exists(KnowledgeDocument::class) && Schema::hasTable('knowledge_documents')) {
                $titles = KnowledgeDocument::query()
                    ->where('status', 'active')
                    ->orderByDesc('id')
                    ->limit(200)
                    ->pluck('title');

                foreach ($titles as $title) {
                    $words = [...$words, ...$this->extractWords((string) $title)];
                }
            }

            if (class_exists(KnowledgeChunk::class) && Schema::hasTable('knowledge_chunks')) {
                $contents = KnowledgeChunk::query()
                    ->orderByDesc('id')
                    ->limit(500)
                    ->pluck('content');

                foreach ($contents as $content) {
                    $words = [...$words, ...$this->extractWords((string) $content)];
                }
            }
        } catch (Throwable) {
            return [];
        }

        return array_values(array_unique($words));
    }

    /**
     * Stable lexicon: works even if knowledge base is empty or fully replaced.
     * These are correction TARGETS, not typo=>fix pairs.
     *
     * @return array<int, string>
     */
    private function baseLexicon(): array
    {
        return [
            // brand / product
            'deka', 'chatbot', 'asisten', 'software', 'aplikasi', 'website', 'mobile',
            'digital', 'transformasi', 'teknologi', 'sistem', 'platform', 'solusi',
            // company FAQ topics
            'layanan', 'produk', 'jasa', 'fitur', 'harga', 'biaya', 'tarif',
            'alamat', 'lokasi', 'kantor', 'rute', 'maps', 'peta',
            'kontak', 'telepon', 'email', 'whatsapp', 'sosial', 'media',
            'operasional', 'jam', 'buka', 'tutup', 'jadwal',
            'profil', 'tentang', 'sejarah', 'visi', 'misi', 'perusahaan',
            'founder', 'pendiri', 'tim', 'karyawan', 'pegawai', 'anggota', 'manajemen',
            'siapa', 'jabatan', 'role', 'posisi', 'divisi', 'staff', 'staf',
            'developer', 'programmer', 'backend', 'frontend', 'fullstack', 'designer',
            'design', 'manager', 'direktur',
            'sekretaris', 'penasehat', 'hrd', 'administrasi',
            'portofolio', 'proyek', 'projek', 'klien', 'client', 'partner',
            // common Indonesian query verbs/nouns
            'informasi', 'bantuan', 'pertanyaan', 'penjelasan', 'detail',
            'apa', 'siapa', 'dimana', 'kapan', 'bagaimana', 'kenapa', 'mengapa',
            'cara', 'daftar', 'order', 'pesan', 'konsultasi', 'support',
            'keamanan', 'privasi', 'kebijakan',
            // AI / IT
            'artificial', 'intelligence', 'machine', 'learning', 'data',
            'otomatisasi', 'integrasi', 'pengembangan', 'implementasi',
            // places often in DEKA content (safe general anchors)
            'samarinda', 'kalimantan', 'indonesia',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function extractWords(string $text): array
    {
        if ($text === '') {
            return [];
        }

        if (preg_match_all('/\b[\p{L}][\p{L}\p{N}\-]{3,}\b/u', mb_strtolower($text), $matches) === false) {
            return [];
        }

        $words = [];

        foreach ($matches[0] as $word) {
            if (! $this->isStopword($word)) {
                $words[] = $word;
            }
        }

        return $words;
    }

    private function knowledgeFingerprint(): string
    {
        try {
            if (! Schema::hasTable('knowledge_chunks')) {
                return 'empty';
            }

            $count = (int) KnowledgeChunk::query()->count();
            $maxId = (int) (KnowledgeChunk::query()->max('id') ?? 0);
            $docMax = Schema::hasTable('knowledge_documents')
                ? (string) (KnowledgeDocument::query()->max('updated_at') ?? '0')
                : '0';

            return sha1($count.'|'.$maxId.'|'.$docMax);
        } catch (Throwable) {
            return 'fallback';
        }
    }

    /**
     * @param  array<int, string>  $words
     * @return array<string, true>
     */
    private function indexed(array $words): array
    {
        $index = [];

        foreach ($words as $word) {
            $normalized = mb_strtolower(trim((string) $word));

            if ($normalized !== '' && (! $this->isStopword($normalized) || $this->isQuestionWord($normalized))) {
                $index[$normalized] = true;
            }
        }

        return $index;
    }

    private function isStopword(string $word): bool
    {
        static $stopwords = [
            'yang', 'dan', 'atau', 'untuk', 'dari', 'pada', 'dengan', 'ini', 'itu',
            'apa', 'siapa', 'dimana', 'kapan', 'bagaimana', 'kenapa', 'mengapa',
            'ada', 'saja', 'kah', 'nya', 'di', 'ke', 'ya', 'tidak', 'bukan',
            'the', 'and', 'for', 'with', 'from', 'about', 'what', 'who', 'where',
            'how', 'when', 'why', 'is', 'are', 'was', 'were', 'a', 'an', 'of',
            'to', 'in', 'on', 'at', 'by',
        ];

        return in_array($word, $stopwords, true);
    }

    private function isQuestionWord(string $word): bool
    {
        return in_array($word, [
            'apa', 'siapa', 'dimana', 'kapan', 'bagaimana', 'kenapa', 'mengapa',
        ], true);
    }

    private function ascii(string $value): string
    {
        $value = mb_strtolower($value);
        $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);

        if (! is_string($transliterated) || $transliterated === '') {
            return preg_replace('/[^a-z0-9]/i', '', $value) ?? $value;
        }

        return preg_replace('/[^a-z0-9]/i', '', $transliterated) ?? $transliterated;
    }

    private function preserveCasing(string $original, string $replacement): string
    {
        if (mb_strtoupper($original) === $original) {
            return mb_strtoupper($replacement);
        }

        if (mb_strtolower($original) === $original) {
            return mb_strtolower($replacement);
        }

        return mb_strtoupper(mb_substr($replacement, 0, 1)).mb_substr($replacement, 1);
    }
}
