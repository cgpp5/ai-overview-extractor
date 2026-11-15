# AI Overview Extractor - Source Code Documentation

🔧 **Complete technical documentation for developers working with the AI Overview Extractor extension**

This documentation covers the modular architecture, file dependencies, API interfaces, and development guidelines for the extension source code.

---

## 🏗️ Modular Architecture Overview

The extension follows a **modular architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        Extension Core                        │
├─────────────────────────────────────────────────────────────┤
│  content.js (AIOverviewExtractor) - Main orchestrator      │
│  settings-manager.js - Configuration persistence           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Automation Control                       │
├─────────────────────────────────────────────────────────────┤
│  automation-state-machine.js - Predictable automation flow │
│  automation-circuit-breaker.js - Failure protection        │
│  container-detection-manager.js - Unified container detect │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Auto-Expansion Layer                      │
├─────────────────────────────────────────────────────────────┤
│  auto-expander-overviews.js - AI Overview expansion        │
│  auto-expander-sources.js - Source list expansion          │
│  auto-webhook.js - Automatic webhook sending               │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Extraction System                        │
├─────────────────────────────────────────────────────────────┤
│  extraction-orchestrator.js - Extraction coordination      │
│  content-extractor.js - HTML content extraction            │
│  markdown-generator.js - Markdown conversion               │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                           │
├─────────────────────────────────────────────────────────────┤
│  popup.js/.html/.css - Extension popup interface           │
│  ui-manager.js - In-page UI management                     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Utilities                              │
├─────────────────────────────────────────────────────────────┤
│  webhook-manager.js - HTTP webhook handling                │
│  turndown.js - HTML to Markdown conversion library         │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 Execution Flow

1. **Initialization**: `content.js` loads all modules and settings
2. **State Machine Control**: Automation follows predictable state transitions
3. **Auto-Expansion**: Sequential execution of overview → sources → webhook with circuit breaker protection
4. **Manual Extraction**: User triggers manual markdown extraction
5. **Webhook Integration**: Automatic or manual data sending with error handling

---

## 📁 Detailed File Documentation

### 🎯 Core System

#### `content.js` - Main Extension Controller

**Purpose**: Central orchestrator managing all extension functionality

**Class**: `AIOverviewExtractor`

**Key Responsibilities**:
- Initialize all modules with dependency injection
- Coordinate auto-expansion workflow
- Handle DOM observation and button injection
- Manage message communication with popup

**Dependencies**:
- `SettingsManager` - configuration management
- `WebhookManager` - HTTP webhook functionality
- `AutoExpanderOverviews` - AI overview expansion
- `AutoExpanderSources` - source list expansion
- `AutoWebhook` - automatic webhook sending
- `ExtractionOrchestrator` - manual extraction coordination

**Key Methods**:
```javascript
// Main initialization
async init()

// Module coordination
setupModuleCallbacks()
async orchestrateModules()

// DOM management
observeDOM()
checkAndAddButton()
addButton(container)
```

**Configuration**:
- Runs on `*://www.google.com/search*`
- Uses `MutationObserver` for dynamic content detection
- Debounced button injection (300ms)

---

#### `settings-manager.js` - Configuration Persistence

**Purpose**: Manages extension settings with Chrome Storage API

**Class**: `SettingsManager`

**Default Settings**:
```javascript
{
    autoExpandOverviews: true,    // Auto-expand AI overviews
    autoExpandSources: true,      // Auto-expand source lists
    autoSendWebhook: false        // Auto-send webhook data
}
```

**Storage Strategy**:
- Primary: `chrome.storage.local` (extension context)
- Fallback: `localStorage` (web context)
- Storage key: `'ai-overview-settings'`

**Key Methods**:
```javascript
// CRUD operations
async getSettings()                    // Get all settings
async saveSettings(settings)          // Save all settings
async saveSetting(key, value)         // Save single setting
async getSetting(key)                 // Get single setting

// Utility methods
async resetToDefaults()               // Reset to default values
async clearSettings()                 // Remove all settings
validateSettings(settings)            // Validate settings object
async exportSettings()                // Export to JSON
async importSettings(jsonString)      // Import from JSON

// Event handling
onSettingsChanged(callback)           // Listen for changes
```

**Error Handling**:
- Graceful fallback to defaults on errors
- Validation of setting types and structure
- Console logging for debugging

---

### 🤖 Automation Control Modules

#### `automation-state-machine.js` - State Machine Implementation

**Purpose**: Manages predictable automation flow with clear state transitions

**Class**: `AutomationStateMachine`

**State Transitions**:
```
IDLE → EXPANDING_OVERVIEW → EXPANDING_SOURCES → SENDING_WEBHOOK → COMPLETE
```

**Available States**:
- `IDLE` - No automation in progress
- `EXPANDING_OVERVIEW` - AI overview expansion in progress
- `EXPANDING_SOURCES` - Source list expansion in progress  
- `SENDING_WEBHOOK` - Webhook dispatch in progress
- `COMPLETE` - Automation cycle completed

**Key Methods**:
```javascript
// State management
getCurrentState()                     // Get current state
transitionTo(newState)               // Transition to new state
reset()                              // Reset to IDLE state
canTransitionTo(newState)            // Check if transition is valid

// State queries
isIdle()                             // Check if in IDLE state
isProcessing()                       // Check if automation is running
isComplete()                         // Check if automation completed

// Event handling
onStateChange(callback)              // Register state change callback
```

**State Validation**:
- Prevents invalid state transitions
- Logs all state changes for debugging
- Provides hooks for state-dependent behavior

**Error Handling**:
- Invalid transitions return false
- State resets on critical errors
- Comprehensive logging of state changes

---

#### `automation-circuit-breaker.js` - Circuit Breaker Protection

**Purpose**: Prevents infinite loops and system failures during automation

**Class**: `AutomationCircuitBreaker`

**Circuit States**:
- `CLOSED` - Normal operation, allows requests
- `OPEN` - Circuit tripped, blocks requests
- `HALF_OPEN` - Testing if system recovered

**Configuration**:
```javascript
{
    failureThreshold: 5,              // Max failures before opening
    recoveryTimeout: 30000,           // Time before retry (30s)
    monitoringWindow: 60000           // Failure tracking window (60s)
}
```

**Key Methods**:
```javascript
// Circuit control
async execute(operation)              // Execute operation with protection
isOpen()                             // Check if circuit is open
isClosed()                           // Check if circuit is closed
reset()                              // Reset circuit to closed state

// Failure tracking
recordFailure()                      // Record a failure
recordSuccess()                      // Record a success
getFailureCount()                    // Get current failure count

// Status monitoring
getStatus()                          // Get detailed circuit status
```

**Protection Features**:
- Automatic failure counting and thresholds
- Exponential backoff for recovery attempts
- Prevents cascading failures across modules
- Detailed metrics for monitoring

**Integration**:
- Used by all auto-expansion modules
- Prevents infinite clicking attempts
- Graceful degradation to manual mode

---

#### `container-detection-manager.js` - Unified Container Detection

**Purpose**: Provides robust AI Overview container detection with multiple fallback strategies

**Class**: `ContainerDetectionManager`

**Detection Strategies**:
1. **Primary**: `#m-x-content` selector
2. **Fallback**: `[data-attrid="AIOverview"]` containers
3. **Universal**: Text-based content detection
4. **Debounced**: Multiple detection attempts with delays

**Key Methods**:
```javascript
// Container detection
async detectContainer()               // Main detection with all strategies
async detectWithStrategy(strategy)   // Use specific detection strategy
isContainerValid(container)         // Validate detected container

// Detection strategies
async detectById()                   // Detect by #m-x-content ID
async detectByAttribute()            // Detect by data-attrid
async detectByContent()              // Detect by AI Overview text content

// Configuration
setDetectionTimeout(timeout)         // Set detection timeout
setDebounceDelay(delay)              // Set debounce delay
enableStrategy(strategy)             // Enable detection strategy
```

**Debouncing Logic**:
- 300ms default debounce delay
- Prevents multiple rapid detections
- Combines with MutationObserver for efficiency

**Fallback System**:
- Tries multiple selectors in sequence
- Adapts to Google's UI changes
- Provides compatibility across different layouts

**Error Handling**:
- Graceful fallback between strategies
- Detailed logging of detection attempts
- Timeout protection for stuck operations

---

### 🔁 Batch Automation Modules

#### `batch-queue.js` - Queue Expansion and Run Storage

**Purpose**: Shared helpers for the popup and the batch runner. No DOM access, so it runs in both contexts.

**Classes**: `QueryTemplate`, `BatchStore`

**QueryTemplate**:
```javascript
discoverPlaceholders(template)                     // ["city", "month"] in first-seen order
parseValues(raw)                                   // newline separated; commas when single line; deduped
expand(template, valuesByPlaceholder)              // { queries: [{query, variables}], duplicates, error }
buildSearchUrl(query, { language, runId })         // https://www.google.com/search?q=...&hl=...&aioe_run=...
normalizeQuery(query)                              // case/whitespace insensitive comparison
createRunId()                                      // run-YYYYMMDDHHMMSS-xxxx
```

**Expansion rules**:
- The first placeholder is the outer loop (`city` outer, `month` inner)
- Queries that end up identical after whitespace collapsing are dropped and counted as `duplicates`
- Nothing is returned when a placeholder has no values or the product exceeds 1000 queries

**BatchStore**:
```javascript
getState() / saveState(state) / patchState(patch)
saveResult(result) / getResults(runId) / countByStatus(results)
clearResults(runId?) / clearOtherRuns(runId)
getInputs() / saveInputs(inputs)
onStateChanged(callback)
```

**Storage layout**:
- `aioe:batch:state` - single run state: `runId`, `status`, `queryIndex`, `queries`, `config`, `counts`, `pageToken`
- `aioe:batch:result:<runId>:<index>` - one entry per extracted query
- `aioe:batch:inputs` - last used template, values and options

Every result has its own key, so appending a result never rewrites the whole result set.

---

#### `batch-runner.js` - Batch Loop

**Purpose**: Runs the queue stored by the popup, one Google search per page load.

**Class**: `BatchRunner`

**Trigger**: pages whose URL carries `aioe_run=<runId>`; pages without it never touch the queue.

**Per query**:
1. Compare the `q` parameter with `state.queries[state.queryIndex]`; on mismatch re-open the expected query instead of extracting the wrong page
2. Claim the run (`pageToken`) so only one tab continues it
3. Wait for `#m-x-content` up to `config.overviewTimeoutMs`
4. Click the collapsed overview open and click inner "show more/show all" labels inside the container
5. Wait until the rendered text stops growing (`config.settleMs` quiet period)
6. Extract markdown + sources, store the result, advance `queryIndex`
7. Wait `config.delayMs` + jitter, then navigate to the next query

**Outcomes**: `ok`, `no-overview` (container missing or empty) and `error` (exception while extracting); captcha/`/sorry/` pages call `pauseRun()` and keep the queue position.

**UI**: the bottom-right panel (`renderBadge()`) shows position, counts and a Pause button that writes `status: "paused"` to storage.

**Error Handling**:
- Missing overviews never abort the run
- A storage listener aborts the loop as soon as the run is paused, removed or taken over by another tab

---

### 🚀 Auto-Expansion Modules

#### `auto-expander-overviews.js` - AI Overview Expansion

**Purpose**: Automatically expands collapsed AI Overview sections

**Class**: `AutoExpanderOverviews`

**Target Element**: `[aria-expanded="false"][aria-controls="m-x-content"]`

**Workflow**:
1. Check if auto-expansion is enabled in settings
2. Find collapsed AI overview button
3. Click to expand
4. Wait for animation completion (800ms base + validation)
5. Trigger callbacks to next modules

**Key Methods**:
```javascript
async expandAIOverview()              // Main expansion logic
async waitForExpansion()              // Animation completion wait
isExpanded()                          // Check expansion state
isPresent()                           // Check if AI overview exists
onExpansionComplete(callback)         // Register callback
```

**Error Handling**:
- Returns `false` if expansion fails
- Continues execution flow even on failure
- Detailed console logging for debugging

---

#### `auto-expander-sources.js` - Source List Expansion

**Purpose**: Automatically expands collapsed source sections in AI Overview

**Class**: `AutoExpanderSources`

**Target Element**: `div[data-subtree="msc"]` with `[role="button"]`

**Workflow**:
1. Wait for signal from `AutoExpanderOverviews`
2. Check if auto-expansion is enabled
3. Find MSC (Most Shared Content) section
4. Locate and click expansion button
5. Validate expansion success
6. Signal completion to `AutoWebhook`

**Universal Expansion Strategy**:
- Maximum 30 attempts (15 seconds)
- Multiple click methods: `.click()`, `MouseEvent`, `jsaction`
- Validates expansion using `div[style*="height: 100%"]`

**Key Methods**:
```javascript
async expandSources()                 // Main expansion logic
async universalExpandSources()        // Universal click strategy
async tryClickButton(button)          // Multiple click attempts
areSourcesExpanded()                  // Check expansion state
areSourcesPresent()                   // Check if sources exist
setReady()                            // Signal readiness from overview
onExpansionComplete(callback)         // Register callback
```

**Coordination**:
- Waits for `AutoExpanderOverviews` completion
- Signals `AutoWebhook` when finished
- 500ms delay after overview expansion

---

#### `auto-webhook.js` - Automatic Webhook Dispatch

**Purpose**: Automatically sends extracted data to configured webhooks

**Class**: `AutoWebhook`

**Workflow**:
1. Wait for signal from `AutoExpanderSources`
2. Check if auto-webhook is enabled and configured
3. Wait for content stabilization (1000ms)
4. Extract AI overview data
5. Send to webhook endpoint
6. Show user notification

**Key Methods**:
```javascript
async autoSendWebhook()               // Main webhook logic
async prepareWebhookData(container)   // Data preparation
async waitForReady()                  // Wait for expansion signals
showNotification(message)             // User feedback
async isReadyToSend()                 // Check readiness state
setReady()                            // Signal readiness
```

**Data Payload**:
```javascript
{
    searchQuery: string,              // Search keyword
    content: string,                  // Markdown content
    htmlContent: string,              // Cleaned HTML
    sources: Array,                   // Source links
    timestamp: string,                // ISO timestamp
    autoSent: boolean                 // Auto-send flag
}
```

**Dependencies**:
- `WebhookManager` - HTTP request handling
- `window.aiExtractor` - Content extraction methods

---

### 📝 Extraction System

#### `extraction-orchestrator.js` - Extraction Coordination

**Purpose**: Orchestrates manual extraction process triggered by user

**Class**: `ExtractionOrchestrator`

**Workflow**:
1. Extract content and sources from AI overview
2. Generate markdown from extracted data
3. Show preview modal with edit capabilities
4. Handle webhook sending on user request

**Key Methods**:
```javascript
async handleExtraction(container)     // Main extraction flow
async handleWebhookSend(container, markdown) // Webhook dispatch
```

**Dependencies**:
- `ContentExtractor` - data extraction
- `MarkdownGenerator` - markdown conversion
- `UIManager` - preview interface
- `WebhookManager` - webhook functionality

**Error Handling**:
- Try-catch around entire extraction process
- User notifications for errors
- Graceful degradation on component failures

---

#### `content-extractor.js` - Content & Source Extraction

**Purpose**: Extracts and cleans content from AI Overview containers

**Class**: `ContentExtractor`

**Content Cleaning Process**:
1. Mark descendants that are not rendered (no boxes and no rendered children) and drop them from the clone; `display: contents` wrappers are kept because their children are visible
2. Clone container to avoid DOM manipulation
3. Remove `data-subtree="msc"` elements
4. Remove sources section `div[style="height: 100%;"]`
5. Remove hidden elements `[style*="display:none"]`
6. Remove `<style>` and `<script>` tags
7. Strip all `style` and `class` attributes
8. Remove unwanted attributes (`data-ved`, `jsaction`, etc.)
9. Clean inline JavaScript
10. Normalize whitespace

**Key Methods**:
```javascript
extractContent(container)             // Extract and clean HTML
extractSources(container)             // Extract source links
markUnrenderedNodes(container)        // Mark invisible subtrees before cloning
cleanGoogleUrl(url)                   // Remove Google wrappers
extractSearchQuery()                  // Get search keyword from URL
```

**Source Extraction Process**:
1. Find sources container `div[style="height: 100%;"]`
2. Locate visible source list `ul[class]`
3. Extract links `a[href]`
4. Clean Google redirect URLs
5. Filter out Google internal links
6. Generate titles from link text or hostname
7. Deduplicate sources

**URL Cleaning**:
- Removes `/url?` Google wrappers
- Extracts actual destination URLs
- Handles URL encoding/decoding

---

#### `markdown-generator.js` - Markdown Conversion

**Purpose**: Converts extracted content to properly formatted Markdown

**Class**: `MarkdownGenerator`

**Conversion Process**:
1. Initialize TurndownService with custom rules
2. Convert HTML content to Markdown
3. Add the `# AI Overview` header and `**Search Query:**` line; both are optional per call (`options.includeHeader`, `options.includeSearchQuery`), and without the header a leading "AI Overview" label rendered by Google is stripped too
4. Append numbered source list, skipped with `options.includeSources: false`
5. Format final output

**Turndown Configuration**:
```javascript
// Custom rules
addRule('ignoreImages', ...)          // Remove all images
addRule('ignoreSourceLinks', ...)     // Remove source section links
```

**Output Format**:
```markdown
# AI Overview

**Search Query:** [keyword]

[converted content]

## Sources

1. [**Title**](URL)
2. [**Title**](URL)
```

**Key Methods**:
```javascript
createMarkdown(htmlContent, sources, searchQuery, options) // Main conversion; options.includeHeader / includeSearchQuery / includeSources control the title, query line and sources list
stripLeadingOverviewHeading(markdown) // Remove a leading "AI Overview" label rendered by Google
downloadMarkdown(markdown)            // Trigger file download
initializeTurndown()                  // Configure converter
```

**File Download**:
- Creates blob with UTF-8 encoding
- Generates timestamped filename
- Triggers browser download

---

### 🎨 User Interface Components

#### `popup.js` - Extension Popup Management

**Purpose**: Manages the extension popup interface and settings

**Class**: `PopupManager`

**UI Components**:
- Toggle switches for each auto-feature
- Status indicators with icons
- Reset button for defaults
- GitHub link

**Settings Synchronization**:
- Loads current settings on popup open
- Real-time updates across all tabs
- Saves changes immediately with feedback

**Key Methods**:
```javascript
async init()                          // Initialize popup
async loadSettings()                  // Load and display settings
updateUI(settings)                    // Update toggle states
setupEventListeners()                 // Bind event handlers
async handleSettingChange(key, value) // Process setting changes
async handleReset()                   // Reset to defaults
async notifyContentScripts(key, value) // Sync with content scripts
showStatus(icon, text, type)          // Show status messages
```

**Message Communication**:
```javascript
// Sent to content scripts
{
    type: 'SETTING_CHANGED',
    key: string,
    value: boolean
}

{
    type: 'SETTINGS_RESET'
}
```

**Status Management**:
- Loading states with animations
- Success/error feedback
- Auto-hide after 2-3 seconds

---

#### `popup.html` - Popup Interface Structure

**Purpose**: Defines the popup interface structure

**Layout Structure**:
```html
<div class="popup-container">
    <div class="header">               <!-- Title & version -->
    <div class="settings-section">     <!-- Toggle switches -->
    <div class="status-section">       <!-- Status messages -->
    <div class="footer">               <!-- Reset & GitHub -->
</div>
```

**Settings Toggles**:
- Auto expand AI overviews
- Auto expand sources  
- Auto send webhook

**Accessibility Features**:
- Proper label associations
- Focus management
- High contrast support

---

#### `popup.css` - Popup Interface Styling

**Purpose**: Provides styling for the popup interface

**Design System**:
- **Width**: 350px (responsive to 320px)
- **Font**: Apple system fonts
- **Primary Color**: #1a73e8 (Google Blue)
- **Border Radius**: 4-6px
- **Animations**: 0.2-0.3s ease transitions

**Component Styles**:
- **Header**: Gradient background with white text
- **Toggle Switches**: Custom 44x24px with smooth animations
- **Status**: Icon + text with color coding
- **Footer**: Split layout with reset button and GitHub link

**Responsive Features**:
- Adjusts padding and font sizes on smaller screens
- Dark mode support via `@media (prefers-color-scheme: dark)`
- Focus indicators for accessibility

---

#### `ui-manager.js` - In-Page UI Management

**Purpose**: Manages UI elements injected into Google search pages

**Class**: `UIManager`

**Preview Modal Components**:
- **Header**: Title and close button
- **Textarea**: Read-only markdown content
- **Webhook Section**: URL configuration interface
- **Footer**: Copy, download, and webhook buttons

**Webhook Configuration UI**:
- URL input with placeholder
- Test and save buttons
- Status indicator with real-time feedback
- Input validation and error handling

**Key Methods**:
```javascript
async showPreview(markdown, onWebhookSend) // Show extraction preview
async createWebhookSection()           // Build webhook config UI
showNotification(message)              // Show toast notifications
```

**Modal Features**:
- Click-outside-to-close
- Escape key handling
- Responsive design
- Secure content creation (no innerHTML)

**Notification System**:
- Toast-style notifications
- 3-second auto-hide
- Smooth fade animations
- Fixed positioning (top-right)

---

### 🔧 Utility Modules

#### `webhook-manager.js` - HTTP Webhook Handling

**Purpose**: Manages webhook configuration and HTTP requests

**Class**: `WebhookManager`

**Configuration Management**:
- **Storage Key**: `'ai-overview-webhook-url'`
- **Timeout**: 5000ms
- **Security**: HTTPS required (except localhost)

**URL Validation**:
- Valid URL format checking
- HTTPS enforcement
- Localhost exception for development

**HTTP Request Handling**:
- POST method with JSON payload
- AbortController for timeouts
- Comprehensive error handling
- Response status validation

**Key Methods**:
```javascript
// Configuration
async saveWebhookUrl(webhookUrl)      // Save webhook URL
async getWebhookUrl()                 // Get saved URL
async removeWebhookUrl()              // Delete configuration
async isConfigured()                  // Check if configured

// Validation
isValidWebhookUrl(url)                // Validate URL format

// Testing & Sending
async testWebhook(webhookUrl)         // Test connection
async sendToWebhook(data)             // Send actual data

// Payload creation
createPayload(data)                   // Format data for sending
async makeRequest(url, payload)       // Execute HTTP request
```

**Payload Structure**:
```javascript
{
    timestamp: "2025-01-06T12:30:00Z",
    searchQuery: "search keyword",
    aiOverview: {
        content: "markdown content",
        htmlContent: "cleaned HTML"
    },
    sources: [
        {title: "Title", url: "https://url.com"}
    ],
    metadata: {
        googleSearchUrl: "https://google.com/search?q=...",
        extractedAt: "2025-01-06T12:30:00Z",
        userAgent: "Mozilla/5.0...",
        extensionVersion: "1.0.8"
    }
}
```

**Error Handling**:
- Network timeouts (5s limit)
- HTTP status errors
- JSON parsing errors
- AbortController integration

---

#### `turndown.js` - HTML to Markdown Conversion

**Purpose**: Third-party library for HTML to Markdown conversion

**Library**: TurndownService v7.2.0

**Configuration**: Used by `MarkdownGenerator` with custom rules

**Features**:
- Block and inline element handling
- Custom rule system
- Code block support
- Link handling (inline/reference)
- Table support

**Custom Rules Added**:
- Image removal rule
- Source link filtering
- Whitespace normalization

---

## 🔗 Dependency Map

### Module Dependencies

```
content.js (Main Controller)
├── settings-manager.js
├── automation-state-machine.js
├── automation-circuit-breaker.js
├── container-detection-manager.js
├── webhook-manager.js
├── auto-expander-overviews.js
├── auto-expander-sources.js
├── auto-webhook.js
└── extraction-orchestrator.js
    ├── content-extractor.js
    ├── markdown-generator.js
    │   └── turndown.js
    └── ui-manager.js
        └── webhook-manager.js

popup.js
└── settings-manager.js
```

### Communication Flow

```
popup.js ←→ content.js (chrome.runtime.onMessage)
    ↓
settings-manager.js ←→ chrome.storage.local
    ↓
auto-expander-overviews.js → auto-expander-sources.js → auto-webhook.js
    ↓
extraction-orchestrator.js
    ├── content-extractor.js
    ├── markdown-generator.js
    └── ui-manager.js → webhook-manager.js
```

### Event Chain

1. **Settings Change**: `popup.js` → `content.js` → all modules
2. **Auto-Expansion**: `overviews` → `sources` → `webhook`
3. **Manual Extraction**: User click → `extraction-orchestrator` → preview modal
4. **Webhook Send**: Modal button → `webhook-manager` → HTTP request

---

## ⚙️ Developer Guidelines

### 🛠️ Setup Instructions

1. **Clone repository**:
```bash
git clone https://github.com/romek-rozen/ai-overview-extractor
cd ai-overview-extractor
```

2. **Load extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select project directory

3. **Load extension in Firefox**:
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `manifest.json`

### 🐛 Debugging

**Console Logging**:
- All modules use consistent `[ModuleName]` prefixes
- Set debug breakpoints in DevTools
- Monitor network requests in DevTools Network tab

**Common Debug Points**:
```javascript
// Check if AI overview container exists
document.querySelector('#m-x-content')

// Check current settings
await new SettingsManager().getSettings()

// Test webhook configuration
await new WebhookManager().isConfigured()
```

**Extension DevTools**:
- **Background Page**: Check service worker logs
- **Content Scripts**: Check page console
- **Popup**: Right-click popup → "Inspect"

### 🧪 Testing

**Automated Tests**:
```bash
node --test
```
- `tests/batch-queue.test.js` covers `QueryTemplate` (placeholder discovery, value parsing, cartesian expansion, duplicate removal, query limit, search URLs) and `BatchStore` (state round trip, per-result keys, clearing, persisted inputs)
- `tests/markdown-generator.test.js` covers the markdown post-processing: optional header/query line, stripping Google's own "AI Overview" label, and the sources section
- No dependencies and no browser needed; the storage layer accepts an injected `storage.local` replacement and the markdown generator runs with a stubbed TurndownService

**Manual Testing Checklist**:
- [ ] Load extension in development mode
- [ ] Navigate to Google Search
- [ ] Search for query with AI Overview
- [ ] Verify auto-expansion works
- [ ] Test manual extraction button
- [ ] Configure and test webhook
- [ ] Test settings persistence
- [ ] Test across different search queries

**Test URLs**:
```
https://www.google.com/search?q=diabetes
https://www.google.com/search?q=machine+learning
https://www.google.com/search?q=climate+change
```

### 📝 Code Style

**Naming Conventions**:
- Classes: `PascalCase`
- Methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_camelCase`

**Error Handling**:
```javascript
try {
    // Main logic
    console.log('[ModuleName] Success message');
    return { success: true };
} catch (error) {
    console.error('[ModuleName] Error message:', error);
    return { success: false, error: error.message };
}
```

**Async/Await Usage**:
- Always use async/await for asynchronous operations
- Handle Promise rejections with try-catch
- Return consistent result objects

### 🔄 Adding New Features

**Step 1: Planning**
- Identify which module should handle the feature
- Consider dependencies and communication needs
- Design the API interface

**Step 2: Implementation**
- Follow existing patterns and conventions
- Add proper error handling and logging
- Update dependencies if needed

**Step 3: Integration**
- Add to manifest.json if needed
- Update settings if configurable
- Add UI elements if required

**Step 4: Testing**
- Test in both Chrome and Firefox
- Test with different Google search scenarios
- Verify no existing functionality is broken

### 📋 Release Process

**Version Update Checklist**:
1. Update `manifest.json` version
2. Update `src/popup.html` version display
3. Update `src/webhook-manager.js` extensionVersion
4. Update `CHANGELOG.md` with changes
5. Test all functionality
6. Create release notes
7. Tag git commit with version

**File Packaging**:
```bash
# Create distribution ZIP
zip -r ai-overview-extractor-v1.0.7.zip . -x "*.git*" "node_modules/*" ".DS_Store" "*.log"
```

---

## 📚 Additional Resources

**Extension APIs Used**:
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Runtime Messaging](https://developer.chrome.com/docs/extensions/reference/runtime/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

**Web APIs Used**:
- [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)

**Libraries**:
- [TurndownJS](https://github.com/domchristie/turndown) - HTML to Markdown conversion

---

## 🤝 Contributing

When contributing to this codebase:

1. **Follow the established architecture patterns**
2. **Add comprehensive logging for debugging**  
3. **Update this documentation for any new modules**
4. **Test across both Chrome and Firefox**
5. **Maintain backward compatibility with settings**

**Questions?** Create an issue on [GitHub](https://github.com/romek-rozen/ai-overview-extractor)

---

*Last updated: December 06, 2025 (v1.0.8)*
