<?php

namespace App\Services\Knowledge;

class KnowledgeChunker
{
    /**
     * @return array<int, string>
     */
    public function chunk(string $content, ?int $size = null, ?int $overlap = null): array
    {
        $content = trim($content);

        if ($content === '') {
            return [];
        }

        $size ??= (int) config('services.deka_knowledge.chunk_size', 1200);
        $overlap ??= (int) config('services.deka_knowledge.chunk_overlap', 180);
        $size = max(300, $size);
        $overlap = min(max(0, $overlap), $size - 1);

        $chunks = [];
        $length = mb_strlen($content);
        $offset = 0;

        while ($offset < $length) {
            $slice = mb_substr($content, $offset, $size);
            $breakAt = $this->naturalBreakPosition($slice);

            if ($breakAt !== null && ($offset + $breakAt) < $length) {
                $slice = mb_substr($slice, 0, $breakAt);
            }

            $slice = trim($slice);

            if ($slice !== '') {
                $chunks[] = $slice;
            }

            $advance = max(1, mb_strlen($slice) - $overlap);
            $offset += $advance;
        }

        return $chunks;
    }

    public function estimateTokens(string $content): int
    {
        return max(1, (int) ceil(mb_strlen($content) / 4));
    }

    private function naturalBreakPosition(string $slice): ?int
    {
        $minimum = (int) floor(mb_strlen($slice) * 0.65);
        $breaks = ["\n\n", "\n", '. ', '? ', '! '];

        foreach ($breaks as $break) {
            $position = mb_strrpos($slice, $break);

            if ($position !== false && $position >= $minimum) {
                return $position + mb_strlen($break);
            }
        }

        return null;
    }
}
