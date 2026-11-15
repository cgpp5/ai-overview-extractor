class MarkdownGenerator {
    constructor() {
        this.turndownService = this.initializeTurndown();
    }

    initializeTurndown() {
        const turndownService = new TurndownService();

        // Dodaj regułę, aby ignorować obrazy
        turndownService.addRule('ignoreImages', {
            filter: 'img',
            replacement: function (content, node) {
                return '';
            }
        });

        // Dodaj regułę, aby ignorować linki w sekcji źródeł
        turndownService.addRule('ignoreSourceLinks', {
            filter: function (node) {
                // Sprawdź, czy węzeł jest linkiem i czy jest potomkiem elementu z klasą LLtSOc
                return node.nodeName === 'A' && node.closest('.LLtSOc');
            },
            replacement: function (content, node) {
                return ''; // Zastąp link pustym ciągiem
            }
        });

        return turndownService;
    }

    createMarkdown(htmlContent, sources, searchQuery = null, options = {}) {
        console.log('[MarkdownGenerator] Tworzę markdown z treścią i źródłami:', sources);

        const includeSearchQuery = options.includeSearchQuery !== false;
        const includeHeader = options.includeHeader !== false;
        const includeSources = options.includeSources !== false;

        let body = this.turndownService.turndown(htmlContent).trim();

        if (!includeHeader) {
            body = this.stripLeadingOverviewHeading(body);
        }

        // Add main header with search keyword
        const headerParts = [];
        if (includeHeader) {
            headerParts.push('# AI Overview');
        }
        if (searchQuery && includeSearchQuery) {
            headerParts.push(`**Search Query:** ${searchQuery}`);
        }

        let markdown = headerParts.length > 0
            ? `${headerParts.join('\n\n')}\n\n${body}\n`
            : `${body}\n`;

        if (includeSources && sources && sources.length > 0) {
            console.log(`[MarkdownGenerator] Adding ${sources.length} sources to markdown`);
            markdown += '\n## Sources\n\n';
            sources.forEach((source, index) => {
                markdown += `${index + 1}. [**${source.title}**](${source.url})\n`;
            });
        } else {
            console.log('[MarkdownGenerator] No sources to add');
        }

        return markdown;
    }

    /**
     * Google renders its own "AI Overview" heading inside the container, which
     * ends up as a heading or bold line at the top of the markdown. When the
     * caller does not want a header, the label is dropped so the text starts
     * with the answer itself.
     */
    stripLeadingOverviewHeading(markdown) {
        const label = /^(?:#{1,6}\s*)?(?:\*\*)?AI Overview(?:\*\*)?\s*$/i;
        const lines = markdown.split('\n');

        while (lines.length > 0) {
            let index = 0;

            while (index < lines.length && lines[index].trim() === '') {
                index++;
            }

            if (index >= lines.length || !label.test(lines[index].trim())) {
                break;
            }

            lines.splice(index, 1);
        }

        return lines.join('\n').trim();
    }

    downloadMarkdown(markdown) {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-overview-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[MarkdownGenerator] File downloaded');
        return true;
    }
}
