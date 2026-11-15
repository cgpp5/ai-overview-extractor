# AI Overview Extractor - Browser Extension

🔍 **Extract AI Overview content from Google Search to Markdown format**

Extension automatically detects AI Overview on Google results pages and enables exporting content along with sources to readable Markdown format.

- Chrome Extension: https://chromewebstore.google.com/detail/ai-overview-extractor/cbkdfibgmhicgnmmdanlhnebbgonhjje
- Firefox Add-on: https://addons.mozilla.org/en-US/firefox/addon/ai-overview-extractor/

![Extension demo](./images/ai-overviews-extractor.gif)


## 🚀 Features

- ✅ **Automatic detection** of AI Overview on Google Search (`#m-x-content` container)
- 📋 **Content extraction** to Markdown format using TurndownService library
- 🧹 **Advanced cleaning** - removes MSC elements, CSS, JavaScript and hidden elements
- 🔍 **Automatic extraction** of search keyword from query
- 🔗 **Source extraction** with cleaned Google URLs
- 💾 **Copy** to clipboard with one click
- 📥 **Download** as .md file with timestamp
- 🔁 **Batch search** - run one query template across variable lists (cities, months, ...) and extract every AI Overview automatically
- 📤 **JSON export** - one file per run with the markdown, sources, URL and timestamp of every query
- 🚀 **Webhooks** - automatic sending of data to external APIs
- ⚙️ **Webhook configuration** - easy URL setup and connection testing
- 🎨 **Clean interface** with preview and notifications
- 🔄 **DOM Observer** - automatic button addition for new results
- 🤖 **Intelligent State Machine** - Predictable automation flow control
- 🛡️ **Circuit Breaker Protection** - Automatic failure detection and recovery
- 🔄 **Unified Detection System** - Robust container detection with multiple fallback strategies
- ⚙️ **Advanced Debugging** - Real-time system status monitoring and reset capabilities

## 📦 Installation

### Method 1: Chrome/Chromium - Developer Mode

1. **Download files** - copy all files to `ai-overview-extractor/` folder
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable** "Developer mode" (toggle in top right corner)
4. **Click** "Load unpacked extension"
5. **Select** `ai-overview-extractor/` folder
6. **Done!** Extension will be loaded

### Method 2: Firefox - Developer Mode

1. **Download files** - copy all files to `ai-overview-extractor/` folder
2. **Open Firefox** and navigate to `about:debugging`
3. **Click** "This Firefox" in left menu
4. **Click** "Load Temporary Add-on..."
5. **Select** `manifest.json` file from extension folder
6. **Done!** Extension will be loaded

### Method 3: Firefox - Permanent Installation

1. Go to `about:config` in Firefox
2. Find `xpinstall.signatures.required` and set to `false`
3. Pack extension folder to `.zip` file
4. Change extension to `.xpi`
5. Drag `.xpi` file to Firefox

## 🎯 Usage

### Basic extraction
1. **Search** for something on Google (e.g. "diabetes")
2. **Wait** for AI Overview to appear
3. **Click** "Show more" button
4. **Click** "Show all"
5. **Click** "📋 Extract to Markdown" button
6. **Copy** content or download as file

### Webhook configuration
1. **Click** "📋 Extract to Markdown" button
2. **In "🔗 Webhook Configuration" section** enter your API URL
3. **Test connection** with "🧪 Test" button
4. **Save configuration** with "💾 Save" button
5. **Send data** with "🚀 Send webhook" button

### Batch search (many queries at once)
Use this when you want the same question answered for many variables, for example attractions per city and month.

1. **Open the popup** and fill the **Template** with `{placeholders}`:
   `what are the main attractions in {city} in {month}`
2. **One field per placeholder appears** - enter one value per line:
   ```
   {city}     {month}
   Madrid     March
   Paris      June
   Rome       September
   ```
   The counter next to the title shows how many queries the lists produce (cartesian product, duplicates removed, hard limit 1000).
3. **Set the options** (optional):
   - **Delay (s)** - pause between searches, default 5 seconds (a random 0-1.5 s jitter is added)
   - **Language** - `hl` parameter for the search URL, default `en`
   - **Overview wait (s)** - how long to wait for the AI Overview on each page, default 10 seconds
   - **Append sources to the markdown body** - checked by default; uncheck it to store only the answer text. The `sources` array is always kept in the JSON either way.
4. **Click "Start / resume"** - the extension opens (or reuses) a Google Search tab and starts the queue.
5. **Let it run** - each page is loaded, the AI Overview is expanded, the markdown and sources are extracted, and the result is stored before the next search starts. A small panel in the bottom-right corner of the page shows progress and has a **Pause** button.
6. **Export** - when the run finishes press **Export JSON**. The file `ai-overview-batch-<runId>.json` contains the template, the variables, the run configuration and one entry per query:
   ```json
   {
     "run": { "runId": "run-20250106123000-ab12", "template": "...", "total": 9, "counts": { "ok": 8, "noOverview": 1, "error": 0 } },
     "results": [
       {
         "index": 0,
         "query": "what are the main attractions in Madrid in March",
         "variables": { "city": "Madrid", "month": "March" },
         "status": "ok",
         "markdown": "Madrid in March offers mild spring weather ...",
         "sources": [{ "title": "Retiro Park guide", "url": "https://..." }],
         "url": "https://www.google.com/search?q=...",
         "extractedAt": "2025-01-06T12:30:11.000Z"
       }
     ]
   }
   ```
   **Copy JSON** puts the same payload on the clipboard.

**Behaviour worth knowing**

- Queries without an AI Overview are stored with `"status": "no-overview"` and listed in the popup, so you can review them instead of guessing what is missing.
- The `markdown` field starts at the answer itself: no `# AI Overview` heading and no query line, because the query already has its own field.
- The run keeps going if a single query fails; failures are stored with `"status": "error"` and the error message.
- If Google shows a captcha or `/sorry/` page, the run pauses itself. Solve it in the tab, then press **Start / resume**.
- Pausing keeps every result already stored. **Reset run** only clears the queue pointer; **Clear results** deletes the stored results of all runs.
- The queue lives in extension storage and is tied to the tab through the `aioe_run` URL parameter, so reloads and normal browsing in other tabs never touch it.

### Example webhook URLs
```
https://your-api.com/ai-overview-webhook
https://example.com/webhook-endpoint
https://api.your-domain.com/receive-ai-data
http://localhost:5678/webhook/ai-overview-extractor  # n8n locally
```

## 🔗 n8n Integration

The extension is fully compatible with n8n and includes a ready-made template workflow for comprehensive automation!

### 🚀 Ready n8n Template

In the `workflows_templates/` folder you'll find ready workflow `AI_Overviews_Extractor_Plugin.json` which contains:

#### 📋 Workflow features:
1. **Webhook endpoint** - automatic data reception from extension
2. **HTML→Markdown processing** - content conversion
3. **Google Sheets saving** - automatic results storage
4. **AI Guidelines Generator** - LLM generates SEO guidelines based on AI Overview
5. **Automation** - scheduler every 15 minutes + manual trigger
6. **Page analysis** - fetching and analyzing content from URLs

#### 🛠️ Template installation:

1. **In n8n go to:** `Templates` → `Import from JSON`
2. **Load file:** `workflows_templates/AI_Overviews_Extractor_Plugin.json`
3. **Configure nodes:**
   - Google Sheets (OAuth connection)
   - OpenRouter Chat Model (API key)
   - Set Google Sheets URL in nodes
4. **Activate workflow**
5. **Copy webhook URL** (from Webhook node)

#### ⚙️ Extension configuration:

1. **Webhook URL:** `http://localhost:5678/webhook/ai-overview-extractor`
2. **Test connection** - should return status 200
3. **Save configuration**

#### 📊 What the workflow does:

- **Receives data** from extension (keyword, markdown, HTML, sources)
- **Saves to sheet** all AI Overview data
- **Analyzes pages** from Google Sheets (`myURL` column)
- **Generates SEO guidelines** using AI (compares page content with AI Overview)
- **Updates sheet** with generated guidelines
- **Automatic execution** every 15 minutes for new tasks

#### 🎯 Benefits:

- **Full automation** - from extraction to analysis
- **Knowledge base** - all AI Overviews in one place  
- **SEO insights** - AI guidelines on what to add to page
- **Scalability** - batch processing of multiple URLs
- **Monitoring** - tracking changes in AI Overview

### 🔧 n8n Requirements:

- **n8n v1.95.3+** (locally or in cloud)
- **Google Sheets API** (for data saving)
- **OpenRouter API** (for AI guidelines) or other LLM provider
- **Webhook endpoint** active on port 5678

## 📁 File Structure

```
ai-overview-extractor/
├── manifest.json      # Extension configuration (Manifest V3)
├── styles.css         # User interface styles
├── README.md          # This documentation
├── LICENCE            # MIT License
├── .gitignore         # Files ignored by Git
├── AI_SUMMARY.md      # 🤖 CRITICAL: Technical documentation for AI/LLM systems - main project overview
├── src/              # Source files
│   ├── content.js                    # Main orchestrator with AIOverviewExtractor class
│   ├── automation-state-machine.js  # State machine for automation flow control
│   ├── automation-circuit-breaker.js # Circuit breaker protection against failures
│   ├── container-detection-manager.js # Unified container detection system
│   ├── settings-manager.js           # Extension settings management
│   ├── auto-expander-overviews.js    # Automatic AI overview expansion
│   ├── auto-expander-sources.js      # Automatic source list expansion
│   ├── auto-webhook.js               # Automatic webhook dispatch
│   ├── batch-queue.js                # Query template expansion and batch run storage
│   ├── batch-runner.js               # Content-script batch loop (one search per page load)
│   ├── extraction-orchestrator.js    # Manual extraction coordination
│   ├── content-extractor.js          # Content and source extraction
│   ├── markdown-generator.js         # Markdown conversion
│   ├── ui-manager.js                 # In-page UI management
│   ├── popup.js                      # Extension popup management
│   ├── popup.html                    # Popup interface structure
│   ├── popup.css                     # Popup interface styling
│   ├── webhook-manager.js            # Webhook management and POST requests
│   ├── turndown.js                   # HTML→Markdown conversion library
│   └── README.md                     # Source code documentation
├── icons/            # Extension icons
│   ├── icon-16.png
│   ├── icon-32.png  
│   ├── icon-48.png
│   ├── icon-96.png
│   └── icon-128.png
├── images/           # Documentation images
│   ├── ai-overviews-extractor.gif
│   ├── ai-overview-extractor-001.jpg
│   └── ai_overviews_extractor_logo.png
├── workflows_templates/  # Ready n8n workflow template
│   ├── AI_Overviews_Extractor_Plugin.json  # Comprehensive n8n workflow
│   └── README.md                            # Workflow documentation
├── n8n-template-submission/  # n8n Template Store submission files
│   ├── AI_Overviews_Extractor_Plugin.json  # Template workflow file
│   ├── README.md                            # Template description
│   ├── setup-instructions.md               # Installation instructions
│   ├── template-description.md             # Detailed template description
│   └── template-name.txt                   # Template name
├── tests/            # Node tests (no dependencies)
│   └── batch-queue.test.js                 # Template expansion and batch storage
└── docs/             # Publication and legal documentation
    ├── chrome-web-store-description.md         # Chrome Web Store description
    ├── chrome-web-store-privacy-justifications.md # Chrome privacy justifications
    ├── chrome-web-store-permission-justifications.md # Chrome permission justifications
    ├── chrome-web-store-appeal-response.md     # Chrome Store rejection response
    ├── firefox-release-notes.md                # Firefox Add-ons release notes
    ├── firefox-reviewer-notes.md               # Firefox reviewer notes
    └── privacy-policy.md                       # Privacy policy
```

## ⚙️ Requirements

- **Chrome/Chromium** (latest version) or **Firefox** 58+ (Firefox Quantum)
- **Manifest V3** - modern extension standard
- **Page**: `google.com/search`
- **Language**: Works with Google interface in any language
- **Permissions**: `storage`, `host_permissions: *://www.google.com/*`

## 🔧 Configuration

Extension works automatically on:
- `*://www.google.com/search*`

To add other Google domains, edit `content_scripts.matches` section in `manifest.json`:

```json
"content_scripts": [
  {
    "matches": [
      "*://www.google.com/search*",
      "*://www.google.pl/search*",
      "*://www.google.de/search*"
    ],
    "js": ["src/turndown.js", "src/content.js"],
    "css": ["styles.css"],
    "run_at": "document_end"
  }
]
```

## 🔍 How it works

### AI Overview Detection
- Looks for `#m-x-content` container on page
- Uses `MutationObserver` to monitor DOM changes
- Automatically adds button when container is found
- **State Machine Architecture** - Predictable automation flow: IDLE → EXPANDING_OVERVIEW → EXPANDING_SOURCES → SENDING_WEBHOOK → COMPLETE

### Content Extraction
- Removes elements with `data-subtree="msc"` (MSC elements)
- Removes elements that are not rendered at all (hidden sidebars, `aria-hidden` AI Mode panels); elements with `display: contents` are kept because their children are visible
- Removes elements with `style="display:none"` (hidden elements)
- Removes sources container before conversion
- Converts HTML to Markdown using TurndownService

### Source Extraction
- Finds sources container `div[style="height: 100%;"]`
- Extracts links from visible list `ul[class]`
- **Improved button detection** - Fixed jsaction selector for reliable expansion
- Cleans Google URLs (removes `/url?` wrappers)
- Filters duplicates and invalid links

### Automation System
- **Circuit Breaker Protection** - Prevents infinite loops and system failures
- **Unified Container Detection** - Multiple fallback strategies with debouncing
- **Enhanced Debugging** - `getAutomationStatus()` and `resetAutomation()` methods
- **Robust Error Handling** - Automatic fallback to manual mode

### Batch Runner
- **Storage-driven queue** - `aioe:batch:state` holds the expanded queries and the current position; every result is written to its own key (`aioe:batch:result:<runId>:<index>`)
- **Tab binding through the URL** - batch searches carry `aioe_run=<runId>`; only pages with that marker touch the queue, and `pageToken` makes the newest tab the owner of a run
- **Per-query flow** - wait for `#m-x-content`, click the collapsed overview open, click inner "show more/show all" labels, wait until the text stops growing, then extract markdown and sources
- **Outcome recording** - `ok`, `no-overview` (no AI Overview for that query) or `error`, each with markdown, sources, URL and timestamp
- **Pause, resume, recover** - pausing only changes the stored state; resuming re-opens the pending query, and a captcha/`/sorry/` page pauses the run instead of failing it

### Webhooks
- **Automatic sending** of data to external APIs via POST method
- **UI configuration** - easy webhook URL setup
- **Connection testing** - check if webhook works
- **Secure storage** - URL saved in chrome.storage
- **Complete payload** - keyword, markdown, HTML and sources
- **Error handling** - 5s timeout and informative messages

#### Webhook data format:
```json
{
  "timestamp": "2025-01-06T12:30:00Z",
  "searchQuery": "search keyword",
  "aiOverview": {
    "content": "markdown content",
    "htmlContent": "cleaned HTML"
  },
  "sources": [
    {"title": "Title", "url": "https://url.com"}
  ],
  "metadata": {
    "googleSearchUrl": "https://google.com/search?q=...",
    "extractedAt": "2025-01-06T12:30:00Z",
    "userAgent": "Mozilla/5.0...",
    "extensionVersion": "1.0.8"
  }
}
```

## 🐛 Troubleshooting

### Button doesn't appear
- Check if AI Overview is actually on the page
- Open console (F12) and look for `[AI Overview Extractor]` logs
- Check if `#m-x-content` element exists
- Refresh page and wait for full loading

### Sources not expanding automatically
- Check console for `[AutoExpanderSources]` logs
- Verify auto-expand sources is enabled in popup settings
- Try refreshing page if button detection fails
- Check for jsaction attribute changes in new Google updates

### No content in markdown
- AI Overview may not be fully loaded
- Try again after a few seconds
- Check console logs - they should show extraction process
- Check for JavaScript errors

### Copy error
- Check if browser has clipboard permissions
- Try downloading file instead of copying
- Check if page is served over HTTPS

### Source issues
- Check console logs about found links
- Some sources may be filtered (Google, support etc.)
- URLs are automatically cleaned from Google wrappers

### Automation issues
- Use `getAutomationStatus()` in console to check system state
- Use `resetAutomation()` to reset state machine if stuck
- Check circuit breaker status in console logs
- Verify settings are properly saved in popup

## 🔄 Updates

To update the extension:

**Chrome/Chromium:**
1. Download new files
2. Replace old files in extension folder
3. Go to `chrome://extensions/`
4. Click "Reload" on the extension

**Firefox:**
1. Download new files
2. Replace old files in extension folder
3. Go to `about:debugging`
4. Click "Reload" on the extension

## 📝 Changelog

### v1.0.9 (current)
- 🔁 **Batch search automation** - one query template plus variable lists is expanded into a queue (cartesian product, duplicates removed, limit 1000) and run automatically
- 🤖 **Batch runner** - a new content-script module loads each search, expands the AI Overview, extracts markdown and sources, stores the result and moves to the next query
- 🧭 **Tab-bound queue** - searches carry an `aioe_run` URL marker and a per-tab ownership token, so reloads, restored tabs and other Google tabs never disturb a run
- ⏸️ **Pause / resume / recovery** - popup controls plus an on-page progress panel; captcha and `/sorry/` pages pause the run instead of failing it
- 📤 **JSON export** - `ai-overview-batch-<runId>.json` with every query, its markdown, sources, URL, timestamp and status (`ok`, `no-overview`, `error`)
- 🧪 **Tests** - `node --test` covers template expansion and the batch storage layer

### v1.0.8
- 🐛 **Fixed auto-expand sources functionality** - Fixed critical issue where sources were not expanding automatically
- 🔧 **Button selector bug** - Fixed jsaction selector from `^="trigger"` to `*="trigger"` to properly match `jsaction="trigger.Wyhgxe"`
- ⏱️ **Timing improvements** - Increased delays for better DOM loading stability (1500ms, 1000ms, 3000ms)
- 🔍 **Expansion detection logic** - Made `areSourcesExpanded()` more conservative to prevent false positives
- 🛡️ **Button clicking prevention** - Added `buttonClicked` flag to prevent multiple clicking attempts
- 🔧 **Reliable Source Expansion** - Fixed button detection with improved jsaction selectors

### v1.0.7
- 🏗️ **Major Architecture Refactor** - Replaced callback-based system with state machine for predictable automation flow
- 🔧 **State Machine Implementation** - Clear automation states: IDLE → EXPANDING_OVERVIEW → EXPANDING_SOURCES → SENDING_WEBHOOK → COMPLETE
- 🛡️ **Circuit Breaker Protection** - Added circuit breakers to prevent infinite loops and system failures
- 🎯 **Unified Container Detection** - Single manager for all container detection with debouncing and multiple strategies
- 🐛 **Fixed Automation Issues** - Resolved multiple button clicks, infinite loops, and unpredictable behavior
- 📊 **Enhanced Debugging** - Added `getAutomationStatus()` and `resetAutomation()` methods for system monitoring
- 🔍 **Improved Reliability** - Robust error handling with automatic fallback to manual mode
- ⚙️ **Modular Design** - Clean separation of concerns with well-defined module interfaces

### v1.0.6
- ✨ **Auto-expand AI overviews** - Automatically clicks "Show more" button on collapsed AI overviews
- 🔗 **Auto-expand sources** - Automatically expands collapsed source sections
- 🚀 **Auto-webhook functionality** - Automatically sends extracted data to configured endpoints
- ⚙️ **Settings management** - Persistent storage with Chrome storage API
- 🎨 **Extension popup interface** - Modern settings panel accessible from browser toolbar
- 🔄 **Real-time synchronization** - Changes applied immediately across all tabs

### v1.0.5
- 🔧 **Chrome Web Store compliance** - removed unnecessary `activeTab` permission
- 📝 **Documentation update** - updated all permission justifications and descriptions
- ✅ **Verification** - confirmed extension works with minimal permissions only
- 🏪 **Store ready** - prepared for Chrome Web Store resubmission

### v1.0.4
- 🌍 **English translation** - complete interface and documentation translation
- 🎨 **UI improvements** - updated button text and user messages
- 📝 **Documentation** - fully translated README and user guides
- 🧹 **Code cleanup** - improved console messages and comments

### v1.0.3
- 🚀 **NEW: Webhooks** - automatic data sending to external APIs
- ⚙️ **Webhook configuration** - UI for URL setup and testing
- 🧹 **Improved cleaning** - removal of CSS, JavaScript and inline styles
- 💾 **Chrome Storage** - secure configuration storage
- 🔒 **HTTPS validation** - webhook security
- ⏱️ **Timeout handling** - error handling and timeouts (5s)

### v1.0.2
- 🔧 Stability and compatibility fixes
- 📱 Manifest V3 support
- 🌐 Chrome and Firefox compatibility

### v1.0.1
- 🐛 Source extraction bug fixes
- ⚡ Performance optimizations
- 🔍 Improved AI Overview detection

### v1.0.0
- ✨ First version
- 📋 AI Overview extraction to Markdown with TurndownService
- 🔗 Source extraction with Google URL cleaning
- 🧹 Advanced content filtering (MSC, hidden elements)
- 💾 Copy and download with timestamp
- 🎨 User interface with notifications
- 🔄 DOM observer for dynamic changes

## 🤝 Contributing

Project is open source! You can:
- 🐛 **Report bugs** via Issues on GitHub
- 💡 **Suggest features** 
- 🔧 **Send Pull Requests**
- ⭐ **Star** if you like the project

**GitHub:** https://github.com/romek-rozen/ai-overview-extractor

## 👨‍💻 Author

**Roman Rozenberger**
- GitHub: https://github.com/romek-rozen
- Website: https://rozenberger.com

## 📄 License

MIT License - you can use, modify and distribute for free.

---

**Useful? Leave a ⭐ and share with others!**

Created with ❤️ for SEO and digital marketing community.
