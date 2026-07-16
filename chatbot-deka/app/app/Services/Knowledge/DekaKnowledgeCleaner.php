<?php

namespace App\Services\Knowledge;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;

class DekaKnowledgeCleaner
{
    /**
     * @return array{title: string|null, content: string}
     */
    public function extract(string $html): array
    {
        $document = new DOMDocument;

        libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="utf-8" ?>'.$html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();

        $xpath = new DOMXPath($document);

        foreach (['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'form'] as $tag) {
            $nodes = $xpath->query('//'.$tag);

            if ($nodes === false) {
                continue;
            }

            foreach ($nodes as $node) {
                if (! $node instanceof DOMNode || $node->parentNode === null) {
                    continue;
                }

                $node->parentNode->removeChild($node);
            }
        }

        $title = $this->normalizeText($xpath->evaluate('string(//title)') ?: '');
        $root = $this->firstElement($xpath, '//main')
            ?? $this->firstElement($xpath, '//article')
            ?? $this->firstElement($xpath, '//body');

        $content = $this->normalizeText($root instanceof DOMElement ? $root->textContent : $document->textContent);

        return [
            'title' => $title !== '' ? mb_substr($title, 0, 500) : null,
            'content' => $content,
        ];
    }

    /**
     * @return array<int, string>
     */
    public function chunk(string $content, int $chunkSize = 1200, int $overlap = 180): array
    {
        $content = $this->normalizeText($content);

        if ($content === '') {
            return [];
        }

        $chunks = [];
        $length = mb_strlen($content);
        $offset = 0;

        while ($offset < $length) {
            $slice = mb_substr($content, $offset, $chunkSize);

            if ($offset + $chunkSize < $length) {
                $lastBoundary = max(
                    mb_strrpos($slice, '. ') ?: 0,
                    mb_strrpos($slice, "\n") ?: 0,
                    mb_strrpos($slice, ' ') ?: 0,
                );

                if ($lastBoundary > 300) {
                    $slice = mb_substr($slice, 0, $lastBoundary + 1);
                }
            }

            $chunk = trim($slice);

            if ($chunk !== '') {
                $chunks[] = $chunk;
            }

            $advance = max(1, mb_strlen($slice) - $overlap);
            $offset += $advance;
        }

        return array_values(array_unique($chunks));
    }

    private function normalizeText(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\s*\R\s*/u', "\n", $text) ?? $text;
        $text = preg_replace('/\n{3,}/u', "\n\n", $text) ?? $text;

        return trim($text);
    }

    private function firstElement(DOMXPath $xpath, string $query): ?DOMElement
    {
        $nodes = $xpath->query($query);

        if ($nodes === false) {
            return null;
        }

        $node = $nodes->item(0);

        return $node instanceof DOMElement ? $node : null;
    }
}
