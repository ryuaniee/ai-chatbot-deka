<?php

namespace App\Services\Knowledge;

class DekaKnowledgeQueryNormalizer
{
    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array{primary: string, alternates: array<int, string>, ambiguous: bool}
     */
    public function normalize(string $question, array $history = []): array
    {
        $question = $this->clean($question);
        $normalized = $this->normalized($question);
        $fixedQuestion = $this->applyTypoFixes($question);
        $topicQueries = $this->topicQueries($normalized);
        $personQueries = $this->personAliasQueries($normalized);
        $contextQueries = $this->contextualFollowUpQueries($normalized, $history);

        $queries = $this->isShortFollowUp($normalized) && ($topicQueries !== [] || $contextQueries !== [])
            ? [...$topicQueries, ...$contextQueries, ...$personQueries, $fixedQuestion]
            : [$fixedQuestion, ...$topicQueries, ...$personQueries, ...$contextQueries];

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
        ];
    }

    /**
     * @return array<int, string>
     */
    private function topicQueries(string $normalized): array
    {
        return match (true) {
            $this->containsAny($normalized, ['kontak', 'kontakny', 'kontaknya', 'alamat', 'alamatnya', 'hubungi']) => [
                'kontak DEKA',
                'alamat DEKA',
                'website DEKA',
                'media sosial DEKA',
            ],
            $this->containsAny($normalized, ['founder', 'pendiri', 'foundernya', 'pendirinya']) => [
                'founder DEKA',
                'pendiri DEKA',
                'Muhammad Rizky Hajar',
                'tim awal DEKA',
            ],
            $this->containsAny($normalized, ['layanan', 'layanannya', 'produk', 'produknya', 'jasa']) => [
                'layanan DEKA',
                'produk DEKA',
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
     * @return array<int, string>
     */
    private function personAliasQueries(string $normalized): array
    {
        $queries = [];

        if ($this->containsAny($normalized, ['riski', 'riskı', 'risky', 'rizki', 'rizky', 'rizqy'])) {
            $queries = [
                ...$queries,
                'Muhammad Rizky Hajar',
                'Rizky Hajar',
                'founder DEKA',
                'pendiri DEKA',
            ];
        }

        if ($this->containsAny($normalized, ['rifqi', 'rifki', 'rifqy', 'oktachandra'])) {
            $queries = [
                ...$queries,
                'M. Rifqi Oktachandra',
                'Rifqi Oktachandra',
                'tim awal DEKA',
            ];
        }

        if ($this->containsAny($normalized, ['abdul', 'rahman', 'rachman'])) {
            $queries = [
                ...$queries,
                'Abdul Rahman',
                'tim awal DEKA',
                'pendiri DEKA',
            ];
        }

        if ($this->containsAny($normalized, ['aditya', 'adit', 'cahyadi', 'cahya'])) {
            $queries = [
                ...$queries,
                'Aditya Cahyadi',
                'tim awal DEKA',
            ];
        }

        return $queries;
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array<int, string>
     */
    private function contextualFollowUpQueries(string $normalized, array $history): array
    {
        if (! $this->isShortFollowUp($normalized)) {
            return [];
        }

        $recentContext = $this->normalized(collect($history)
            ->slice(-4)
            ->pluck('content')
            ->implode(' '));

        if ($recentContext === '') {
            return [];
        }

        if ($this->containsAny($normalized, ['nya', 'itu', 'tersebut']) || mb_strlen($normalized) <= 16) {
            return [
                ...$this->topicQueries($normalized.' '.$recentContext),
                ...$this->personAliasQueries($normalized.' '.$recentContext),
            ];
        }

        return [];
    }

    private function isAmbiguousDekaQuestion(string $normalized): bool
    {
        return $this->containsAny($normalized, ['siapa deka', 'siapa di deka', 'orang deka', 'pak siapa', 'ibu siapa'])
            || ($this->containsAny($normalized, ['pak ', 'bu ', 'bapak ', 'ibu '])
                && ! $this->containsAny($normalized, ['riski', 'risky', 'rizki', 'rizky', 'rifqi', 'rifki', 'abdul', 'rahman', 'aditya']));
    }

    private function isShortFollowUp(string $normalized): bool
    {
        return mb_strlen($normalized) <= 32
            || $this->containsAny($normalized, ['nya', 'itu', 'tersebut']);
    }

    private function applyTypoFixes(string $question): string
    {
        $fixed = preg_replace('/\bdeak\b/i', 'DEKA', $question) ?? $question;
        $fixed = preg_replace('/\bdekaa\b/i', 'DEKA', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bdeka\b/i', 'DEKA', $fixed) ?? $fixed;
        $fixed = preg_replace('/\bkontakny\b/i', 'kontaknya', $fixed) ?? $fixed;
        $fixed = preg_replace('/\brisky\b/i', 'Rizky', $fixed) ?? $fixed;
        $fixed = preg_replace('/\briski\b/i', 'Rizky', $fixed) ?? $fixed;
        $fixed = preg_replace('/\brizki\b/i', 'Rizky', $fixed) ?? $fixed;

        return $fixed;
    }

    /**
     * @param  array<int, string>  $needles
     */
    private function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) {
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
