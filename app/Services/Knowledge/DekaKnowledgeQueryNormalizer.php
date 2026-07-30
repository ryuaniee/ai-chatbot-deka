<?php

namespace App\Services\Knowledge;

class DekaKnowledgeQueryNormalizer
{
    public function __construct(
        private readonly ?FuzzyTypoCorrector $typoCorrector = null,
    ) {}

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array{primary: string, alternates: array<int, string>, ambiguous: bool, original: string, corrected: string}
     */
    public function normalize(string $question, array $history = []): array
    {
        $question = $this->clean($question);
        $fixedQuestion = $this->applyTypoFixes($question);
        $fixedQuestion = $this->shouldSkipFuzzyTypoCorrection($fixedQuestion)
            ? $fixedQuestion
            : $this->applyFuzzyTypoCorrection($fixedQuestion);
        $fixedQuestion = $this->applyTypoFixes($fixedQuestion);
        $normalized = $this->normalized($fixedQuestion);
        $topicQueries = $this->topicQueries($normalized);

        if (
            $topicQueries === []
            && preg_match('/^(?:(pak|bu|bapak|ibu) )?(siapa|siapa saja|siapa saja yang ada|orang siapa)(?: di)? deka\??$/u', $normalized) === 1
        ) {
            $topicQueries = [
                'tim karyawan DEKA',
                'struktur tim DEKA',
                $fixedQuestion,
            ];
        }

        $contextQueries = $this->contextualFollowUpQueries($normalized, $history);

        $queries = $this->shouldPrioritizeTopicQueries($normalized, $topicQueries)
            ? [...$topicQueries, ...$contextQueries, $fixedQuestion]
            : ($this->isShortFollowUp($normalized) && ($topicQueries !== [] || $contextQueries !== [])
            ? [...$topicQueries, ...$contextQueries, $fixedQuestion]
            : [$fixedQuestion, ...$topicQueries, ...$contextQueries]);

        // Keep original (pre-fuzzy) phrasing as alternate so retrieval still sees raw user words.
        if ($question !== $fixedQuestion) {
            $queries[] = $question;
        }

        $queries = collect($queries)
            ->map(fn (string $query): string => $this->clean($query))
            ->filter(static fn (string $query): bool => $query !== '')
            ->unique(static fn (string $query): string => mb_strtolower($query))
            ->values()
            ->all();

        return [
            'primary' => $queries[0] ?? $question,
            'alternates' => array_slice($queries, 1),
            'ambiguous' => $this->isAmbiguousDekaQuestion($normalized),
            'original' => $question,
            'corrected' => $fixedQuestion,
        ];
    }

    private function applyFuzzyTypoCorrection(string $question): string
    {
        $corrector = $this->typoCorrector ?? new FuzzyTypoCorrector;

        return $this->clean($corrector->correct($question));
    }

    /**
     * @return array<int, string>
     */
    private function topicQueries(string $normalized): array
    {
        return match (true) {
            $this->containsAny($normalized, [
                'struktur tim', 'struktur organisasi', 'tim', 'karyawan', 'pegawai',
                'staff', 'staf', 'anggota tim', 'personel', 'jabatan', 'role',
                'posisi', 'divisi', 'developer', 'programmer', 'backend', 'frontend',
                'front end', 'fullstack', 'full stack', 'designer', 'design',
                'ui', 'ux', 'manager', 'direktur', 'sekretaris', 'penasehat',
                'hrd', 'administrasi',
            ]) => [
                'tim karyawan DEKA',
                'struktur tim DEKA',
                'daftar karyawan DEKA',
                'anggota tim DEKA',
                'nama dan jabatan tim DEKA',
            ],
            $this->containsAny($normalized, ['kontak', 'kontakny', 'kontaknya', 'alamat', 'alamatnya', 'lokasi', 'kantor', 'rute', 'sana', 'hubungi', 'whatsapp', 'wa', 'telepon', 'telpon', 'nomor', 'nomer', 'hp']) => [
                'kontak DEKA',
                'WhatsApp DEKA',
                'nomor WhatsApp DEKA',
                'telepon DEKA',
                'alamat DEKA',
                'lokasi kantor DEKA',
                'website DEKA',
                'media sosial DEKA',
            ],
            $this->containsAny($normalized, [
                'founder', 'pendiri', 'foundernya', 'pendirinya', 'pendiriinya',
                'sejarah', 'awal berdiri', 'tim awal', 'rekan',
            ]) => [
                'sejarah DEKA',
                'awal berdiri DEKA',
                'founder DEKA',
                'pendiri DEKA',
                'tim awal DEKA',
            ],
            $this->containsAny($normalized, ['produk', 'produknya', 'katalog', 'inaproc', 'harga']) => [
                'Produk DEKA di INAPROC Katalog Elektronik',
                'produk DEKA INAPROC',
                'daftar produk DEKA di INAPROC',
                'URL produk DEKA di INAPROC',
                'harga produk DEKA INAPROC',
            ],
            $this->containsAny($normalized, ['layanan', 'layanannya', 'jasa']) => [
                'layanan DEKA',
                'jasa DEKA',
                'solusi digital DEKA',
            ],
            $this->containsAny($normalized, ['proyek', 'projek', 'portfolio', 'portofolio', 'klien']) => [
                'proyek DEKA',
                'portofolio DEKA',
                'klien DEKA',
            ],
            default => [],
        };
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array<int, string>
     */
    private function contextualFollowUpQueries(string $normalized, array $history): array
    {
        if (
            ! $this->isShortFollowUp($normalized)
            || $this->topicQueries($normalized) !== []
            || preg_match('/(?:nya)\b|\b(ini|itu|tadi|tersebut|dia|mereka)\b/u', $normalized) !== 1
        ) {
            return [];
        }

        $recentContext = $this->normalized(collect($history)
            ->slice(-4)
            ->pluck('content')
            ->implode(' '));

        if ($recentContext === '') {
            return [];
        }

        return [
            ...$this->topicQueries($normalized.' '.$recentContext),
        ];
    }

    private function isAmbiguousDekaQuestion(string $normalized): bool
    {
        return $this->containsAny($normalized, ['siapa deka', 'siapa di deka', 'orang deka', 'pak siapa', 'ibu siapa'])
            || preg_match('/\b(pak|bu|bapak|ibu)\s+(siapa|yang mana)\b/u', $normalized) === 1;
    }

    private function isShortFollowUp(string $normalized): bool
    {
        return mb_strlen($normalized) <= 32
            || preg_match('/(?:nya|itu|tersebut)\b/u', $normalized) === 1;
    }

    private function applyTypoFixes(string $question): string
    {
        $fixed = preg_replace('/\bdeak\b/i', 'DEKA', $question) ?? $question;
        $fixed = preg_replace('/\bdekaa\b/i', 'DEKA', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bdeka\b/i', 'DEKA', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bcoab\b/i', 'coba', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bdiatas\b/i', 'di atas', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bkontakny\b/i', 'kontaknya', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bnomer\b/i', 'nomor', $fixed) ?? $fixed;
        $fixed = preg_replace('/\btelpon\b/i', 'telepon', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bwa\b/i', 'WhatsApp', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bhp\b/i', 'HP', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bpendiiri\b/i', 'pendiri', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bpendrii\b/i', 'pendiri', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bpendirii\b/i', 'pendiri', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bfounderr\b/i', 'founder', $fixed) ?? $fixed;

        return $fixed;
    }

    private function shouldSkipFuzzyTypoCorrection(string $question): bool
    {
        $normalized = $this->normalized($question);

        return $this->containsAny($normalized, ['produk', 'produknya', 'katalog', 'inaproc', 'harga'])
            || preg_match('/\b(selain|di atas|diatas|sebutkan|lain)\b/u', $normalized) === 1;
    }

    /**
     * @param  array<int, string>  $topicQueries
     */
    private function shouldPrioritizeTopicQueries(string $normalized, array $topicQueries): bool
    {
        return $topicQueries !== []
            && $this->containsAny($normalized, ['produk', 'produknya', 'katalog', 'inaproc', 'harga']);
    }

    /**
     * @param  array<int, string>  $needles
     */
    private function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            $needle = trim($needle);

            if ($needle !== '' && preg_match(
                '/(?<![\pL\pN])'.preg_quote($needle, '/').'(?![\pL\pN])/u',
                $haystack,
            ) === 1) {
                return true;
            }
        }

        return false;
    }

    private function clean(string $value): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    private function normalized(string $value): string
    {
        return mb_strtolower($this->clean($value));
    }
}
