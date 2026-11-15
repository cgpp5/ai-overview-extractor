/**
 * Batch runner: walks the query queue produced by the popup, one Google search
 * per page load. Everything is driven from extension storage, so the run
 * survives reloads and can be paused/resumed at any point.
 */
class BatchRunner {
    constructor({ settingsManager = null } = {}) {
        this.settingsManager = settingsManager;
        this.store = new BatchStore();
        this.queryTemplate = new QueryTemplate();
        this.contentExtractor = new ContentExtractor();
        this.markdownGenerator = new MarkdownGenerator();

        this.runId = null;
        this.token = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.busy = false;
        this.aborted = false;
        this.badge = null;
        this.badgeDismissed = false;
        this.badgeStatus = '';

        console.log('[BatchRunner] Initialized');
    }

    getStatus() {
        if (!this.runId) {
            return null;
        }

        return {
            runId: this.runId,
            token: this.token,
            busy: this.busy,
            aborted: this.aborted,
            status: this.badgeStatus
        };
    }

    async start() {
        const params = new URLSearchParams(window.location.search);
        const marker = params.get('aioe_run') || this.markerFromContinue(params.get('continue'));

        if (!marker) {
            return;
        }

        this.runId = marker;
        const state = await this.store.getState();

        if (!state || state.runId !== this.runId) {
            console.log('[BatchRunner] No matching batch state for this tab, staying idle');
            return;
        }

        this.watchStateChanges();

        if (this.isVerificationPage()) {
            await this.pauseRun('Google is asking for a verification (captcha) in this tab');
            this.renderBadge(await this.store.getState(), 'Paused: verification required');
            return;
        }

        if (state.status === 'running') {
            await this.processCurrentPage(state);
        } else {
            this.renderBadge(state, this.describeIdle(state));
        }
    }

    watchStateChanges() {
        this.store.onStateChanged((newState) => {
            if (!newState || newState.runId !== this.runId) {
                this.aborted = true;
                this.renderBadge(null, 'Batch run was removed');
                return;
            }

            if (newState.pageToken && newState.pageToken !== this.token) {
                // Another tab took over this run.
                this.aborted = true;
                this.renderBadge(newState, 'Handed over to another tab');
                return;
            }

            if (newState.status !== 'running') {
                this.aborted = true;
                this.renderBadge(newState, this.describeIdle(newState));
                return;
            }

            if (!this.busy) {
                this.renderBadge(newState, 'Waiting');
            }
        });
    }

    /**
     * Google's verification page keeps the original URL (and therefore the run
     * marker) inside the "continue" parameter.
     */
    markerFromContinue(continueUrl) {
        if (!continueUrl) {
            return null;
        }

        try {
            return new URL(continueUrl, window.location.origin).searchParams.get('aioe_run');
        } catch (error) {
            return null;
        }
    }

    describeIdle(state) {
        if (!state) {
            return 'Idle';
        }

        if (state.status === 'paused') {
            const reason = state.stopReason ? `: ${state.stopReason}` : '';
            return `Paused at ${state.queryIndex}/${state.queries.length}${reason}`;
        }

        if (state.status === 'completed') {
            return `Completed ${state.queries.length}/${state.queries.length}`;
        }

        return state.status || 'Idle';
    }

    async processCurrentPage(state) {
        if (this.busy || this.aborted) {
            return;
        }

        this.busy = true;

        try {
            const item = state.queries[state.queryIndex];

            if (!item) {
                await this.completeRun(state);
                return;
            }

            this.renderBadge(state, `Checking search ${state.queryIndex + 1}/${state.queries.length}`);

            if (!this.isOnExpectedQuery(item.query)) {
                // The tab is on a different search (resume, back button, manual edit).
                // Re-open the expected query instead of recording the wrong page.
                this.renderBadge(state, `Re-opening search ${state.queryIndex + 1}/${state.queries.length}`);
                await this.sleep(600);
                this.navigateTo(state, item.query);
                return;
            }

            // Take ownership first so later writes keep the claimed state
            state = await this.claimRun(state);
            if (this.aborted) {
                return;
            }

            this.renderBadge(state, `Extracting ${state.queryIndex + 1}/${state.queries.length}`);
            const outcome = await this.extractCurrentOverview(state.config || {});

            if (this.aborted) {
                return;
            }

            if (outcome.blocked) {
                await this.pauseRun('Google is asking for a verification (captcha) in this tab');
                this.renderBadge(await this.store.getState(), 'Paused: verification required');
                return;
            }

            if (outcome.paused) {
                this.renderBadge(await this.store.getState(), 'Paused');
                return;
            }

            const result = this.buildResult(state, item, outcome);
            await this.store.saveResult(result);
            await this.advance(state, result);
        } catch (error) {
            console.error('[BatchRunner] Error while processing query:', error);
            await this.recordFailure(state, error);
        } finally {
            this.busy = false;
        }
    }

    isOnExpectedQuery(expectedQuery) {
        const pageQuery = this.contentExtractor.extractSearchQuery();
        if (!pageQuery) {
            return true; // Not readable (e.g. redirect page), let the extraction decide
        }

        return this.queryTemplate.normalizeQuery(pageQuery) === this.queryTemplate.normalizeQuery(expectedQuery);
    }

    async claimRun(state) {
        // The tab that wrote the token last owns the run. A duplicated or stale
        // tab stops as soon as it sees a different token.
        return await this.store.saveState({
            ...state,
            pageToken: this.token,
            heartbeatAt: new Date().toISOString()
        });
    }

    navigateTo(state, query) {
        const url = this.queryTemplate.buildSearchUrl(query, {
            language: (state.config || {}).language || '',
            runId: this.runId
        });

        console.log('[BatchRunner] Navigating to next search:', url);
        window.location.assign(url);
    }

    async extractCurrentOverview(config) {
        const timeoutMs = Math.max(3000, Number(config.overviewTimeoutMs) || 12000);
        const settleMs = Math.max(400, Number(config.settleMs) || 1500);

        const container = await this.waitForContainer(timeoutMs);
        if (container === 'blocked') {
            return { blocked: true };
        }

        if (!container) {
            console.log('[BatchRunner] No AI Overview on this page');
            return { status: 'no-overview', markdown: '', sources: [], textLength: 0 };
        }

        await this.expandIfCollapsed();
        if (this.aborted) {
            return { paused: true };
        }

        this.expandInnerCollapsibles(container);
        await this.waitForStableText(container, settleMs);

        if (this.aborted) {
            return { paused: true };
        }

        let text = (container.innerText || container.textContent || '').trim();
        if (text.length < 20) {
            // The container can be in the DOM before the overview streams in.
            text = await this.waitForText(container, 20, 3000);
        }

        if (text.length < 20) {
            console.log('[BatchRunner] AI Overview container is empty');
            return { status: 'no-overview', markdown: '', sources: [], textLength: text.length };
        }

        const htmlContent = this.contentExtractor.extractContent(container);
        const sources = this.contentExtractor.extractSources(container);
        const searchQuery = this.contentExtractor.extractSearchQuery();

        // The batch result already carries the query in its own JSON field and the
        // answer stands on its own, so the markdown body needs neither the query
        // line nor the "AI Overview" heading
        const markdown = this.markdownGenerator.createMarkdown(htmlContent, sources, searchQuery, {
            includeSearchQuery: false,
            includeHeader: false,
            includeSources: config.includeSources !== false
        });

        return { status: 'ok', markdown, sources, textLength: text.length };
    }

    async waitForContainer(timeoutMs) {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            if (this.aborted) {
                return null;
            }

            if (this.isVerificationPage()) {
                return 'blocked';
            }

            const container = document.querySelector('#m-x-content');
            if (container) {
                return container;
            }

            await this.sleep(400);
        }

        if (this.isVerificationPage()) {
            return 'blocked';
        }

        return null;
    }

    async expandIfCollapsed() {
        const expandButton = document.querySelector('[aria-expanded="false"][aria-controls="m-x-content"]');
        if (!expandButton) {
            return false;
        }

        console.log('[BatchRunner] Expanding collapsed AI Overview');
        expandButton.click();

        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
            if (document.querySelector('[aria-expanded="true"][aria-controls="m-x-content"]')) {
                return true;
            }
            await this.sleep(200);
        }

        return false;
    }

    /**
     * Clicks "Show more"/"Show all" style buttons inside the overview so the
     * stored markdown matches what a user would see after expanding.
     */
    expandInnerCollapsibles(container) {
        const labels = [
            'show more', 'show all', 'read more',
            'pokaż więcej', 'pokaż wszystko', 'więcej',
            'mostrar más', 'mostrar todo',
            'mehr anzeigen', 'alles anzeigen',
            'afficher plus', "afficher tout",
            'mostra altro', 'mostra tutto'
        ];

        const clickable = container.querySelectorAll('button, [role="button"]');
        for (const element of clickable) {
            const label = (element.innerText || element.textContent || '').trim().toLowerCase();
            if (labels.includes(label)) {
                try {
                    element.click();
                } catch (error) {
                    console.warn('[BatchRunner] Could not click expandable element:', error);
                }
            }
        }
    }

    /**
     * The overview streams in after the container appears, so wait until the
     * rendered text stops growing.
     */
    async waitForStableText(element, quietMs, maxMs = 8000) {
        const startedAt = Date.now();
        let lastLength = -1;
        let lastChange = Date.now();

        while (Date.now() - startedAt < maxMs) {
            if (this.aborted) {
                return;
            }

            const length = (element.innerText || element.textContent || '').trim().length;

            if (length !== lastLength) {
                lastLength = length;
                lastChange = Date.now();
            } else if (Date.now() - lastChange >= quietMs) {
                return;
            }

            await this.sleep(200);
        }
    }

    /**
     * Polls until the container renders at least minLength characters, or the
     * timeout expires. Returns the last observed text.
     */
    async waitForText(element, minLength, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        let text = (element.innerText || element.textContent || '').trim();

        while (text.length < minLength && Date.now() < deadline && !this.aborted) {
            await this.sleep(250);
            text = (element.innerText || element.textContent || '').trim();
        }

        return text;
    }

    isVerificationPage() {
        if (window.location.pathname.startsWith('/sorry')) {
            return true;
        }

        // Deliberately narrow: invisible reCAPTCHA iframes also appear on normal
        // result pages, so only a real challenge form counts as blocked.
        return !!document.querySelector('form#captcha-form, div.g-recaptcha');
    }

    buildResult(state, item, outcome) {
        const status = outcome.status || (outcome.markdown ? 'ok' : 'no-overview');

        return {
            runId: state.runId,
            index: state.queryIndex,
            query: item.query,
            variables: item.variables || {},
            status,
            markdown: outcome.markdown || '',
            sources: outcome.sources || [],
            textLength: outcome.textLength || 0,
            url: window.location.href,
            extractedAt: new Date().toISOString()
        };
    }

    async advance(state, result) {
        const counts = { ...(state.counts || { ok: 0, noOverview: 0, error: 0 }) };
        if (result.status === 'ok') {
            counts.ok++;
        } else if (result.status === 'no-overview') {
            counts.noOverview++;
        } else {
            counts.error++;
        }

        const nextIndex = state.queryIndex + 1;
        const base = {
            ...state,
            counts,
            lastOutcome: result.status,
            lastQuery: result.query,
            lastResultAt: result.extractedAt
        };

        if (nextIndex >= state.queries.length) {
            await this.completeRun({ ...base, queryIndex: nextIndex });
            return;
        }

        const nextQuery = state.queries[nextIndex].query;
        await this.store.saveState({
            ...base,
            queryIndex: nextIndex,
            currentQuery: nextQuery
        });

        const config = state.config || {};
        const delayMs = Math.max(1000, Number(config.delayMs) || 5000);
        const jitterMs = Math.max(0, Number(config.jitterMs) || 0);
        const waitMs = delayMs + Math.floor(Math.random() * jitterMs);

        this.renderBadge(
            { ...base, queryIndex: nextIndex },
            `Next in ${Math.round(waitMs / 1000)}s: ${this.truncate(nextQuery, 60)}`
        );

        await this.sleep(waitMs);

        const latest = await this.store.getState();
        if (!latest || latest.runId !== this.runId || latest.status !== 'running') {
            console.log('[BatchRunner] Run paused or stopped during the delay');
            return;
        }

        if (latest.pageToken && latest.pageToken !== this.token) {
            console.log('[BatchRunner] Another tab owns the run, stopping here');
            return;
        }

        this.navigateTo(latest, latest.queries[latest.queryIndex].query);
    }

    async completeRun(stateOrBase) {
        const finished = await this.store.saveState({
            ...stateOrBase,
            status: 'completed',
            completedAt: new Date().toISOString(),
            pageToken: null,
            currentQuery: null
        });

        console.log('[BatchRunner] Batch run completed:', finished.counts);
        this.renderBadge(finished, `Completed ${finished.queries.length}/${finished.queries.length}. Open the popup to export JSON.`);
    }

    async recordFailure(state, error) {
        if (this.aborted || !state || !state.queries) {
            return;
        }

        const item = state.queries[state.queryIndex];
        if (!item) {
            return;
        }

        const result = {
            runId: state.runId,
            index: state.queryIndex,
            query: item.query,
            variables: item.variables || {},
            status: 'error',
            markdown: '',
            sources: [],
            textLength: 0,
            error: error ? String(error.message || error) : 'Unknown error',
            url: window.location.href,
            extractedAt: new Date().toISOString()
        };

        try {
            await this.store.saveResult(result);
            await this.advance(state, result);
        } catch (advanceError) {
            console.error('[BatchRunner] Could not record failure:', advanceError);
        }
    }

    async pauseRun(reason) {
        const state = await this.store.getState();
        if (!state || state.runId !== this.runId || state.status !== 'running') {
            return;
        }

        console.warn('[BatchRunner] Pausing run:', reason);
        this.aborted = true;
        await this.store.saveState({
            ...state,
            status: 'paused',
            stopReason: reason,
            pageToken: null
        });
    }

    renderBadge(state, statusText) {
        if (state) {
            this.badgeStatus = statusText;
        }

        if (this.badgeDismissed) {
            return;
        }

        if (!this.badge) {
            this.badge = this.createBadge();
            document.body.appendChild(this.badge.root);
        }

        this.badge.title.textContent = state
            ? `Batch ${Math.min(state.queryIndex + 1, state.queries.length)}/${state.queries.length}`
            : 'Batch';
        this.badge.query.textContent = state && state.queries[state.queryIndex]
            ? this.truncate(state.queries[state.queryIndex].query, 80)
            : (state && state.currentQuery) || '';
        this.badge.status.textContent = statusText;

        const counts = state ? state.counts : null;
        this.badge.counts.textContent = counts
            ? `${counts.ok || 0} with overview / ${counts.noOverview || 0} without`
            : '';

        const canPause = !!state && state.status === 'running';
        this.badge.pause.style.display = canPause ? 'inline-block' : 'none';
    }

    createBadge() {
        const root = document.createElement('div');
        root.className = 'aioe-batch-badge';

        const header = document.createElement('div');
        header.className = 'aioe-batch-badge-header';

        const title = document.createElement('span');
        title.className = 'aioe-batch-badge-title';

        const close = document.createElement('button');
        close.className = 'aioe-batch-badge-close';
        close.textContent = '×';
        close.title = 'Hide this panel (the run keeps going)';
        close.addEventListener('click', () => {
            // Only hides the panel for this page view; the run keeps going.
            this.badgeDismissed = true;
            this.badge = null;
            root.remove();
        });

        header.appendChild(title);
        header.appendChild(close);

        const query = document.createElement('div');
        query.className = 'aioe-batch-badge-query';

        const status = document.createElement('div');
        status.className = 'aioe-batch-badge-status';

        const counts = document.createElement('div');
        counts.className = 'aioe-batch-badge-counts';

        const pause = document.createElement('button');
        pause.className = 'aioe-batch-badge-pause';
        pause.textContent = 'Pause';
        pause.addEventListener('click', async () => {
            await this.pauseRun('Paused from the page');
            this.renderBadge(await this.store.getState(), 'Paused');
        });

        root.appendChild(header);
        root.appendChild(query);
        root.appendChild(status);
        root.appendChild(counts);
        root.appendChild(pause);

        return { root, title, query, status, counts, pause };
    }

    truncate(text, maxLength) {
        const value = String(text || '');
        return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

if (typeof window !== 'undefined') {
    window.BatchRunner = BatchRunner;
}
