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

        if (preg_match('/^#{1,6}\h+\S+/m', $content) === 1) {
            return $this->chunkMarkdown($content, $size, $overlap);
        }

        return $this->chunkText($content, $size, $overlap);
    }

    /**
     * @return array<int, string>
     */
    private function chunkMarkdown(string $content, int $size, int $overlap): array
    {
        $sections = preg_split('/(?=^#{1,6}\h+\S+)/m', $content, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $chunks = [];
        $headingPath = [];

        foreach ($sections as $rawSection) {
            $rawSection = trim($rawSection);

            if ($rawSection === '') {
                continue;
            }

            $section = $rawSection;

            if (preg_match('/^(#{1,6})\h+([^\n]+)\n?(.*)$/su', $rawSection, $matches) === 1) {
                $level = mb_strlen($matches[1]);
                $heading = trim($matches[1].' '.$matches[2]);
                $body = trim($matches[3]);

                foreach (array_keys($headingPath) as $existingLevel) {
                    if ($existingLevel >= $level) {
                        unset($headingPath[$existingLevel]);
                    }
                }

                $headingPath[$level] = $heading;
                ksort($headingPath);
                $section = trim(implode("\n\n", $headingPath).($body !== '' ? "\n\n{$body}" : ''));
            }

            if (mb_strlen($section) <= $size) {
                $chunks[] = $section;

                continue;
            }

            $heading = '';
            $body = $section;

            if (preg_match('/^((?:#{1,6}\h+[^\n]+\n*)+)(.*)$/su', $section, $matches) === 1) {
                $heading = trim($matches[1]);
                $body = trim($matches[2]);
            }

            $prefix = $heading !== '' ? $heading."\n\n" : '';
            $bodySize = max(300, $size - mb_strlen($prefix));
            $bodyOverlap = min($overlap, $bodySize - 1);

            foreach ($this->chunkText($body, $bodySize, $bodyOverlap) as $bodyChunk) {
                $chunks[] = trim($prefix.$bodyChunk);
            }
        }

        return $chunks;
    }

    /**
     * @return array<int, string>
     */
    private function chunkText(string $content, int $size, int $overlap): array
    {
        if ($content === '') {
            return [];
        }

        $chunks = [];
        $length = mb_strlen($content);
        $offset = 0;

        while ($offset < $length) {
            $slice = mb_substr($content, $offset, $size);
            $reachesEnd = ($offset + mb_strlen($slice)) >= $length;
            $breakAt = $reachesEnd ? null : $this->naturalBreakPosition($slice);

            if ($breakAt !== null && ($offset + $breakAt) < $length) {
                $slice = mb_substr($slice, 0, $breakAt);
            }

            $consumedLength = mb_strlen($slice);
            $trimmedSlice = trim($slice);

            if ($trimmedSlice !== '') {
                $chunks[] = $trimmedSlice;
            }

            if ($reachesEnd) {
                break;
            }

            $advance = max(1, $consumedLength - $overlap);
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
