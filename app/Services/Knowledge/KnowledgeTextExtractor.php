<?php

namespace App\Services\Knowledge;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Support\Facades\File;
use PhpOffice\PhpWord\IOFactory;
use RuntimeException;
use Smalot\PdfParser\Parser;

class KnowledgeTextExtractor
{
    /**
     * @return array{title: string|null, content: string, metadata: array<string, mixed>}
     */
    public function fromFile(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException("Knowledge file [{$path}] does not exist.");
        }

        $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));

        return match ($extension) {
            'html', 'htm' => $this->fromHtml((string) File::get($path)),
            'txt', 'md', 'markdown' => [
                'title' => pathinfo($path, PATHINFO_FILENAME),
                'content' => $this->normalizeText((string) File::get($path)),
                'metadata' => ['extension' => $extension],
            ],
            'pdf' => $this->fromPdf($path),
            'docx' => $this->fromDocx($path),
            default => throw new RuntimeException("Unsupported knowledge file extension [{$extension}]."),
        };
    }

    /**
     * @return array{title: string|null, content: string, metadata: array<string, mixed>}
     */
    public function fromHtml(string $html): array
    {
        $document = new DOMDocument;
        libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="utf-8" ?>'.$html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();

        $xpath = new DOMXPath($document);

        $removableNodes = $xpath->query('//script|//style|//noscript|//svg|//nav|//footer|//header|//form');

        if ($removableNodes !== false) {
            foreach ($removableNodes as $node) {
                if ($node instanceof DOMNode && $node->parentNode instanceof DOMNode) {
                    $node->parentNode->removeChild($node);
                }
            }
        }

        $titleNode = $this->firstXpathNode($xpath, '//title');
        $title = trim($titleNode instanceof DOMNode ? $titleNode->textContent : '') ?: null;
        $main = $this->firstXpathNode($xpath, '//main')
            ?? $this->firstXpathNode($xpath, '//*[@role="main"]')
            ?? $this->firstXpathNode($xpath, '//article')
            ?? $document->getElementsByTagName('body')->item(0);

        $content = $main instanceof DOMElement
            ? $main->textContent
            : $document->textContent;

        return [
            'title' => $title,
            'content' => $this->normalizeText((string) $content),
            'metadata' => ['content_type' => 'text/html'],
        ];
    }

    public function normalizeText(string $text): string
    {
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\R{3,}/u', "\n\n", $text) ?? $text;

        return trim($text);
    }

    private function firstXpathNode(DOMXPath $xpath, string $query): ?DOMNode
    {
        $nodes = $xpath->query($query);
        $node = $nodes !== false ? $nodes->item(0) : null;

        return $node instanceof DOMNode ? $node : null;
    }

    /**
     * @return array{title: string|null, content: string, metadata: array<string, mixed>}
     */
    private function fromPdf(string $path): array
    {
        if (! class_exists(Parser::class)) {
            throw new RuntimeException('PDF ingestion requires smalot/pdfparser.');
        }

        $parser = new Parser;
        $pdf = $parser->parseFile($path);

        return [
            'title' => pathinfo($path, PATHINFO_FILENAME),
            'content' => $this->normalizeText($pdf->getText()),
            'metadata' => ['extension' => 'pdf'],
        ];
    }

    /**
     * @return array{title: string|null, content: string, metadata: array<string, mixed>}
     */
    private function fromDocx(string $path): array
    {
        if (! class_exists(IOFactory::class)) {
            throw new RuntimeException('DOCX ingestion requires phpoffice/phpword.');
        }

        $phpWord = IOFactory::load($path);
        $parts = [];

        foreach ($phpWord->getSections() as $section) {
            foreach ($section->getElements() as $element) {
                if (method_exists($element, 'getText')) {
                    $parts[] = (string) $element->getText();
                }
            }
        }

        return [
            'title' => pathinfo($path, PATHINFO_FILENAME),
            'content' => $this->normalizeText(implode("\n", $parts)),
            'metadata' => ['extension' => 'docx'],
        ];
    }
}
