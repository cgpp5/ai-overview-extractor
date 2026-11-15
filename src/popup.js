class PopupManager {
    constructor() {
        this.settingsManager = new SettingsManager();
        this.queryTemplate = new QueryTemplate();
        this.batchStore = new BatchStore();
        this.batchSaveTimer = null;
        this.batchRefreshTimer = null;
        this.init();
    }

    async init() {
        console.log('[Popup] Initializing popup...');
        
        // Load current settings
        await this.loadSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        await this.initBatch();
        
        console.log('[Popup] Popup initialized');
    }

    async loadSettings() {
        try {
            this.showStatus('⚙️', 'Loading settings...', 'loading');
            
            const settings = await this.settingsManager.getSettings();
            console.log('[Popup] Settings loaded:', settings);
            
            // Update UI with current settings
            this.updateUI(settings);
            
            this.showStatus('✅', 'Settings loaded successfully', 'success');
            
            // Hide status after 2 seconds
            setTimeout(() => {
                this.hideStatus();
            }, 2000);
            
        } catch (error) {
            console.error('[Popup] Error loading settings:', error);
            this.showStatus('❌', 'Error loading settings', 'error');
        }
    }

    updateUI(settings) {
        // Update toggle switches
        const autoExpandOverviews = document.getElementById('autoExpandOverviews');
        const autoExpandSources = document.getElementById('autoExpandSources');
        const autoSendWebhook = document.getElementById('autoSendWebhook');

        if (autoExpandOverviews) {
            autoExpandOverviews.checked = settings.autoExpandOverviews;
        }
        
        if (autoExpandSources) {
            autoExpandSources.checked = settings.autoExpandSources;
        }
        
        if (autoSendWebhook) {
            autoSendWebhook.checked = settings.autoSendWebhook;
        }

        console.log('[Popup] UI updated with settings');
    }

    setupEventListeners() {
        // Auto expand overviews toggle
        const autoExpandOverviews = document.getElementById('autoExpandOverviews');
        if (autoExpandOverviews) {
            autoExpandOverviews.addEventListener('change', async (e) => {
                await this.handleSettingChange('autoExpandOverviews', e.target.checked);
            });
        }

        // Auto expand sources toggle
        const autoExpandSources = document.getElementById('autoExpandSources');
        if (autoExpandSources) {
            autoExpandSources.addEventListener('change', async (e) => {
                await this.handleSettingChange('autoExpandSources', e.target.checked);
            });
        }


        // Auto send webhook toggle
        const autoSendWebhook = document.getElementById('autoSendWebhook');
        if (autoSendWebhook) {
            autoSendWebhook.addEventListener('change', async (e) => {
                await this.handleSettingChange('autoSendWebhook', e.target.checked);
            });
        }


        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                await this.handleReset();
            });
        }

        console.log('[Popup] Event listeners setup complete');
    }

    async handleSettingChange(key, value) {
        try {
            console.log(`[Popup] Changing setting ${key} to ${value}`);
            
            this.showStatus('⚙️', 'Saving setting...', 'loading');
            
            const success = await this.settingsManager.saveSetting(key, value);
            
            if (success) {
                this.showStatus('✅', 'Setting saved', 'success');
                console.log(`[Popup] Setting ${key} saved successfully`);
                
                // Notify content scripts about the change
                await this.notifyContentScripts(key, value);
                
            } else {
                this.showStatus('❌', 'Error saving setting', 'error');
                console.error(`[Popup] Failed to save setting ${key}`);
                
                // Revert the toggle if save failed
                await this.loadSettings();
            }
            
            // Hide status after 2 seconds
            setTimeout(() => {
                this.hideStatus();
            }, 2000);
            
        } catch (error) {
            console.error('[Popup] Error handling setting change:', error);
            this.showStatus('❌', 'Error saving setting', 'error');
            
            // Revert the toggle
            await this.loadSettings();
        }
    }

    async handleReset() {
        try {
            console.log('[Popup] Resetting settings to defaults');
            
            this.showStatus('🔄', 'Resetting settings...', 'loading');
            
            const success = await this.settingsManager.resetToDefaults();
            
            if (success) {
                this.showStatus('✅', 'Settings reset to defaults', 'success');
                console.log('[Popup] Settings reset successfully');
                
                // Reload settings to update UI
                await this.loadSettings();
                
                // Notify content scripts about the reset
                await this.notifyContentScriptsReset();
                
            } else {
                this.showStatus('❌', 'Error resetting settings', 'error');
                console.error('[Popup] Failed to reset settings');
            }
            
            // Hide status after 3 seconds
            setTimeout(() => {
                this.hideStatus();
            }, 3000);
            
        } catch (error) {
            console.error('[Popup] Error resetting settings:', error);
            this.showStatus('❌', 'Error resetting settings', 'error');
        }
    }

    async notifyContentScripts(key, value) {
        try {
            // Send message to all google.com tabs to notify about setting change
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                const tabs = await chrome.tabs.query({ url: '*://www.google.com/*' });
                
                for (const tab of tabs) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'SETTING_CHANGED',
                            key: key,
                            value: value
                        });
                    } catch (error) {
                        // Tab might not have content script loaded, ignore
                        console.log(`[Popup] Could not notify tab ${tab.id}:`, error.message);
                    }
                }
                
                console.log(`[Popup] Notified ${tabs.length} tabs about setting change`);
            }
        } catch (error) {
            console.error('[Popup] Error notifying content scripts:', error);
        }
    }

    async notifyContentScriptsReset() {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                const tabs = await chrome.tabs.query({ url: '*://www.google.com/*' });
                
                for (const tab of tabs) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'SETTINGS_RESET'
                        });
                    } catch (error) {
                        console.log(`[Popup] Could not notify tab ${tab.id} about reset:`, error.message);
                    }
                }
                
                console.log(`[Popup] Notified ${tabs.length} tabs about settings reset`);
            }
        } catch (error) {
            console.error('[Popup] Error notifying content scripts about reset:', error);
        }
    }

    // ---------------------------------------------------------------------
    // Batch search
    // ---------------------------------------------------------------------

    async initBatch() {
        await this.loadBatchInputs();
        this.setupBatchListeners();
        this.setupBatchStorageListener();
        await this.refreshBatchProgress();
    }

    async loadBatchInputs() {
        const inputs = await this.batchStore.getInputs();
        const config = (inputs && inputs.config) || {};

        const templateEl = document.getElementById('batchTemplate');
        if (templateEl && inputs && typeof inputs.template === 'string') {
            templateEl.value = inputs.template;
        }

        const delayEl = document.getElementById('batchDelay');
        if (delayEl) {
            delayEl.value = Math.round((Number(config.delayMs) || 5000) / 1000);
        }

        const languageEl = document.getElementById('batchLanguage');
        if (languageEl && typeof config.language === 'string') {
            languageEl.value = config.language;
        }

        const timeoutEl = document.getElementById('batchTimeout');
        if (timeoutEl) {
            timeoutEl.value = Math.round((Number(config.overviewTimeoutMs) || 10000) / 1000);
        }

        const includeSourcesEl = document.getElementById('batchIncludeSources');
        if (includeSourcesEl) {
            includeSourcesEl.checked = config.includeSources !== false;
        }

        this.renderBatchVariables((inputs && inputs.values) || {});
    }

    setupBatchListeners() {
        const templateEl = document.getElementById('batchTemplate');
        if (templateEl) {
            templateEl.addEventListener('input', () => {
                this.renderBatchVariables(this.collectBatchValues());
                this.scheduleBatchInputSave();
            });
        }

        const variablesEl = document.getElementById('batchVariables');
        if (variablesEl) {
            variablesEl.addEventListener('input', () => {
                this.updateBatchCount();
                this.scheduleBatchInputSave();
            });
        }

        for (const id of ['batchDelay', 'batchLanguage', 'batchTimeout', 'batchIncludeSources']) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.scheduleBatchInputSave());
            }
        }

        const handlers = {
            batchStartBtn: () => this.handleBatchStart(),
            batchPauseBtn: () => this.handleBatchPause(),
            batchExportBtn: () => this.handleBatchExport(),
            batchCopyBtn: () => this.handleBatchCopy(),
            batchResetBtn: () => this.handleBatchReset(),
            batchClearBtn: () => this.handleBatchClear()
        };

        for (const [id, handler] of Object.entries(handlers)) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', handler);
            }
        }
    }

    setupBatchStorageListener() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
            return;
        }

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName && areaName !== 'local') {
                return;
            }

            const touchedBatch = Object.keys(changes || {}).some(key => key.startsWith('aioe:batch:'));
            if (!touchedBatch) {
                return;
            }

            clearTimeout(this.batchRefreshTimer);
            this.batchRefreshTimer = setTimeout(() => this.refreshBatchProgress(), 250);
        });
    }

    renderBatchVariables(values) {
        const templateEl = document.getElementById('batchTemplate');
        const container = document.getElementById('batchVariables');
        if (!templateEl || !container) {
            return;
        }

        const placeholders = this.queryTemplate.discoverPlaceholders(templateEl.value);
        const typed = this.collectBatchValues();
        const source = Object.keys(typed).length > 0 ? typed : (values || {});

        container.textContent = '';

        for (const name of placeholders) {
            const wrapper = document.createElement('div');

            const label = document.createElement('label');
            label.className = 'batch-var-label';
            label.textContent = `{${name}}`;

            const textarea = document.createElement('textarea');
            textarea.className = 'batch-input batch-textarea';
            textarea.rows = 2;
            textarea.dataset.placeholder = name;
            textarea.placeholder = 'One value per line';
            textarea.value = typeof source[name] === 'string' ? source[name] : '';

            wrapper.appendChild(label);
            wrapper.appendChild(textarea);
            container.appendChild(wrapper);
        }

        this.updateBatchCount();
    }

    collectBatchValues() {
        const container = document.getElementById('batchVariables');
        const values = {};

        if (!container) {
            return values;
        }

        for (const textarea of container.querySelectorAll('textarea[data-placeholder]')) {
            values[textarea.dataset.placeholder] = textarea.value;
        }

        return values;
    }

    getBatchExpansion() {
        const templateEl = document.getElementById('batchTemplate');
        const template = templateEl ? templateEl.value : '';
        return this.queryTemplate.expand(template, this.collectBatchValues());
    }

    updateBatchCount() {
        const countEl = document.getElementById('batchCount');
        if (!countEl) {
            return;
        }

        const expansion = this.getBatchExpansion();
        if (!expansion.error) {
            const duplicates = expansion.duplicates ? ` (${expansion.duplicates} duplicates skipped)` : '';
            countEl.textContent = `${expansion.queries.length} queries${duplicates}`;
            countEl.classList.remove('error');
        } else if (/empty/i.test(expansion.error)) {
            countEl.textContent = '0 queries';
            countEl.classList.remove('error');
        } else {
            countEl.textContent = expansion.error;
            countEl.classList.add('error');
        }
    }

    readBatchConfig() {
        const delayEl = document.getElementById('batchDelay');
        const languageEl = document.getElementById('batchLanguage');
        const timeoutEl = document.getElementById('batchTimeout');
        const includeSourcesEl = document.getElementById('batchIncludeSources');

        const delaySeconds = Math.min(120, Math.max(1, Number(delayEl && delayEl.value) || 5));
        const timeoutSeconds = Math.min(120, Math.max(5, Number(timeoutEl && timeoutEl.value) || 10));

        return {
            delayMs: delaySeconds * 1000,
            jitterMs: 1500,
            language: (languageEl && languageEl.value ? languageEl.value : '').trim(),
            overviewTimeoutMs: timeoutSeconds * 1000,
            settleMs: 1500,
            includeSources: includeSourcesEl ? includeSourcesEl.checked : true
        };
    }

    scheduleBatchInputSave() {
        clearTimeout(this.batchSaveTimer);
        this.batchSaveTimer = setTimeout(async () => {
            const templateEl = document.getElementById('batchTemplate');
            await this.batchStore.saveInputs({
                template: templateEl ? templateEl.value : '',
                values: this.collectBatchValues(),
                config: this.readBatchConfig()
            });
        }, 400);
    }

    async handleBatchStart() {
        try {
            const templateEl = document.getElementById('batchTemplate');
            const template = templateEl ? templateEl.value.trim() : '';
            const values = this.collectBatchValues();
            const config = this.readBatchConfig();

            const expansion = this.queryTemplate.expand(template, values);
            if (expansion.error) {
                this.showStatus('', expansion.error, 'error');
                return;
            }

            const queries = expansion.queries;
            const existing = await this.batchStore.getState();
            const canResume = existing
                && existing.status !== 'completed'
                && existing.status !== 'idle'
                && Array.isArray(existing.queries)
                && existing.queries.length === queries.length
                && existing.queries.every((item, index) => item.query === queries[index].query);

            let state;

            if (canResume) {
                state = {
                    ...existing,
                    status: 'running',
                    stopReason: null,
                    pageToken: null,
                    config
                };
            } else {
                const runId = this.queryTemplate.createRunId();

                // A finished run was already exported or can be exported now;
                // results of paused runs are kept so nothing is lost.
                if (existing && existing.status === 'completed') {
                    await this.batchStore.clearOtherRuns(runId);
                }

                state = {
                    runId,
                    status: 'running',
                    queryIndex: 0,
                    queries,
                    template,
                    values,
                    config,
                    counts: { ok: 0, noOverview: 0, error: 0 },
                    createdAt: new Date().toISOString(),
                    startedAt: new Date().toISOString(),
                    pageToken: null,
                    stopReason: null,
                    currentQuery: queries[0].query
                };
            }

            await this.batchStore.saveInputs({ template, values, config });
            await this.batchStore.saveState(state);
            await this.openBatchTab(state);

            const label = canResume
                ? `Resuming at ${state.queryIndex + 1}/${state.queries.length}`
                : `Starting ${state.queries.length} searches`;
            this.showStatus('', label, 'success');
            await this.refreshBatchProgress();
        } catch (error) {
            console.error('[Popup] Error starting batch:', error);
            this.showStatus('', 'Could not start the batch run', 'error');
        }
    }

    async openBatchTab(state) {
        const item = state.queries[state.queryIndex];
        if (!item) {
            return false;
        }

        const url = this.queryTemplate.buildSearchUrl(item.query, {
            language: (state.config && state.config.language) || '',
            runId: state.runId
        });

        if (typeof chrome === 'undefined' || !chrome.tabs) {
            window.open(url, '_blank');
            return true;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const active = tabs && tabs[0];
        const isGoogleSearch = active
            && typeof active.url === 'string'
            && active.url.startsWith('https://www.google.com/search');

        if (isGoogleSearch) {
            await chrome.tabs.update(active.id, { url });
        } else {
            await chrome.tabs.create({ url });
        }

        return true;
    }

    async handleBatchPause() {
        const state = await this.batchStore.getState();
        if (!state) {
            return;
        }

        await this.batchStore.saveState({
            ...state,
            status: 'paused',
            stopReason: 'paused from popup',
            pageToken: null
        });

        this.showStatus('', 'Batch run paused', 'success');
        await this.refreshBatchProgress();
    }

    buildExportPayload(state, results) {
        const counts = this.batchStore.countByStatus(results);

        return {
            export: {
                extension: 'AI Overview Extractor',
                version: '1.0.9',
                exportedAt: new Date().toISOString()
            },
            run: {
                runId: state.runId,
                template: state.template || '',
                values: state.values || {},
                config: state.config || {},
                status: state.status,
                queryIndex: state.queryIndex,
                total: Array.isArray(state.queries) ? state.queries.length : 0,
                counts,
                startedAt: state.startedAt || state.createdAt || null,
                completedAt: state.completedAt || null
            },
            results: results.map(result => ({
                index: result.index,
                query: result.query,
                variables: result.variables || {},
                status: result.status,
                markdown: result.markdown || '',
                sources: result.sources || [],
                url: result.url || null,
                extractedAt: result.extractedAt || null,
                error: result.error || null
            }))
        };
    }

    async getBatchExportJson() {
        const state = await this.batchStore.getState();
        if (!state || !Array.isArray(state.queries) || state.queries.length === 0) {
            return null;
        }

        const results = await this.batchStore.getResults(state.runId);
        if (results.length === 0) {
            return null;
        }

        const payload = this.buildExportPayload(state, results);
        return { state, results, payload, json: JSON.stringify(payload, null, 2) };
    }

    async handleBatchExport() {
        const exportData = await this.getBatchExportJson();
        if (!exportData) {
            this.showStatus('', 'Nothing to export yet', 'error');
            return;
        }

        const blob = new Blob([exportData.json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-overview-batch-${exportData.state.runId}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.showStatus('', `Exported ${exportData.results.length} results`, 'success');
    }

    async handleBatchCopy() {
        const exportData = await this.getBatchExportJson();
        if (!exportData) {
            this.showStatus('', 'Nothing to copy yet', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(exportData.json);
            this.showStatus('', `Copied ${exportData.results.length} results as JSON`, 'success');
        } catch (error) {
            console.error('[Popup] Clipboard error:', error);
            this.showStatus('', 'Could not copy to clipboard', 'error');
        }
    }

    async handleBatchReset() {
        const state = await this.batchStore.getState();
        if (!state) {
            return;
        }

        // Keeps the template, values and stored results; only the queue pointer resets.
        await this.batchStore.saveState({
            ...state,
            status: 'idle',
            queryIndex: 0,
            queries: [],
            currentQuery: null,
            counts: { ok: 0, noOverview: 0, error: 0 },
            pageToken: null,
            stopReason: null,
            completedAt: null
        });

        this.showStatus('', 'Batch run reset', 'success');
        await this.refreshBatchProgress();
    }

    async handleBatchClear() {
        const removed = await this.batchStore.clearResults();
        const state = await this.batchStore.getState();

        if (state) {
            await this.batchStore.saveState({
                ...state,
                counts: { ok: 0, noOverview: 0, error: 0 }
            });
        }

        this.showStatus('', `Removed ${removed} stored results`, 'success');
        await this.refreshBatchProgress();
    }

    batchLine(text, extraClass = '') {
        const line = document.createElement('span');
        line.className = `batch-line ${extraClass}`.trim();

        if (text) {
            line.textContent = text;
        }

        return line;
    }

    async refreshBatchProgress() {
        const progress = document.getElementById('batchProgress');
        if (!progress) {
            return;
        }

        const state = await this.batchStore.getState();
        const results = state ? await this.batchStore.getResults(state.runId) : [];
        const counts = this.batchStore.countByStatus(results);

        progress.textContent = '';

        if (!state || !Array.isArray(state.queries) || state.queries.length === 0) {
            progress.appendChild(this.batchLine('No batch run yet. Fill the template above, then press Start / resume.'));
            this.updateBatchButtons(state, results);
            return;
        }

        const total = state.queries.length;

        const header = document.createElement('span');
        header.className = 'batch-line';
        const strong = document.createElement('strong');
        strong.textContent = `${results.length}/${total}`;
        header.appendChild(strong);
        header.appendChild(document.createTextNode(` · ${state.status}`));
        progress.appendChild(header);

        progress.appendChild(this.batchLine(
            `${counts.ok} with AI Overview · ${counts.noOverview} without · ${counts.error} errors`
        ));

        if (state.status === 'running') {
            const current = state.queries[state.queryIndex];
            if (current) {
                progress.appendChild(this.batchLine(`Current: ${current.query}`, 'batch-current'));
            }

            const updatedAt = Date.parse(state.updatedAt || state.startedAt || '');
            if (!Number.isNaN(updatedAt) && Date.now() - updatedAt > 45000) {
                progress.appendChild(this.batchLine(
                    'No progress for a while. Check that the search tab is open and not stuck on a captcha page. If the tab was closed, press Pause and then Start / resume.',
                    'batch-warning'
                ));
            }
        } else if (state.status === 'paused') {
            const reason = state.stopReason ? ` · ${state.stopReason}` : '';
            progress.appendChild(this.batchLine(
                `Paused${reason}. Press "Start / resume" to continue.`,
                'batch-warning'
            ));
        } else if (state.status === 'completed') {
            progress.appendChild(this.batchLine('Run completed. Export the JSON to keep the results.'));
        }

        const missing = results.filter(result => result.status !== 'ok').map(result => result.query);
        if (missing.length > 0) {
            const preview = missing.slice(0, 5).join(' | ');
            const suffix = missing.length > 5 ? ` (+${missing.length - 5} more)` : '';
            progress.appendChild(this.batchLine(`No AI Overview: ${preview}${suffix}`, 'batch-missing'));
        }

        this.updateBatchButtons(state, results);
    }

    updateBatchButtons(state, results) {
        const running = !!state && state.status === 'running';
        const hasResults = Array.isArray(results) && results.length > 0;

        const startBtn = document.getElementById('batchStartBtn');
        if (startBtn) {
            startBtn.disabled = running;
        }

        const pauseBtn = document.getElementById('batchPauseBtn');
        if (pauseBtn) {
            pauseBtn.disabled = !running;
        }

        for (const id of ['batchExportBtn', 'batchCopyBtn', 'batchClearBtn']) {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = !hasResults;
            }
        }

        const resetBtn = document.getElementById('batchResetBtn');
        if (resetBtn) {
            resetBtn.disabled = !state;
        }
    }

    showStatus(icon, text, type = '') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;

        const statusIcon = statusMessage.querySelector('.status-icon');
        const statusText = statusMessage.querySelector('.status-text');
        
        if (statusIcon) statusIcon.textContent = icon;
        if (statusText) {
            statusText.textContent = text;
            statusText.className = `status-text ${type}`;
        }

        // Add loading animation if needed
        if (type === 'loading') {
            statusMessage.classList.add('loading');
        } else {
            statusMessage.classList.remove('loading');
        }

        // Show status
        statusMessage.style.display = 'flex';
    }

    hideStatus() {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;

        statusMessage.style.display = 'none';
        statusMessage.classList.remove('loading');
    }

    // Listen for messages from content scripts
    setupMessageListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                console.log('[Popup] Received message:', message);
                
                if (message.type === 'POPUP_REFRESH_SETTINGS') {
                    this.loadSettings();
                    sendResponse({ success: true });
                }
                
                return true; // Keep message channel open for async response
            });
        }
    }
}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PopupManager();
    });
} else {
    new PopupManager();
}

// Handle popup close
window.addEventListener('beforeunload', () => {
    console.log('[Popup] Popup closing');
});
