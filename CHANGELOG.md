# Changelog

All notable changes to the AI Overview Extractor extension will be documented in this file.

## [1.0.9] - 2026-11-15

### ✨ Added
- **Batch search automation** - the popup now accepts a query template such as `what are the main attractions in {city} in {month}` plus one value list per placeholder, and expands it into a queue (cartesian product, duplicate queries removed, 1000 query limit)
- **Batch runner content script** (`src/batch-runner.js`) - loads each search, waits for `#m-x-content`, expands the collapsed overview, clicks inner "show more/show all" labels, waits for the text to settle, extracts markdown + sources and stores the result before opening the next query
- **Shared queue module** (`src/batch-queue.js`) - `QueryTemplate` for expansion/search URLs and `BatchStore` for run state, per-result keys and last-used inputs
- **On-page progress panel** - bottom-right badge with run position, counts and a Pause button
- **JSON export** - `ai-overview-batch-<runId>.json` containing the template, variables, run configuration and every result (markdown, sources, url, extractedAt, status) plus a "Copy JSON" action
- **Pause / resume / reset / clear** controls in the popup, with live progress via `storage.onChanged`
- **No repeated query or heading in results** - the stored markdown body holds only the answer, the query stays in its own JSON field
- **Sources are optional in the body** - the `Append sources to the markdown body` switch drops the `## Sources` list from the markdown while keeping the `sources` array in the JSON
- **Node tests** - `node --test` covers template expansion and the batch storage layer

### 🔧 Changed
- Manifest version bumped to 1.0.9 and `src/batch-queue.js` / `src/batch-runner.js` added to the content script list
- Content script now also matches `*://www.google.com/sorry/*` so a verification page can pause a batch run instead of silently stalling it
- Content extraction drops elements that are not rendered (hidden sidebars, `aria-hidden` AI Mode panels), so results no longer contain invisible UI text
- Popup widened to 400px and scrollable to fit the batch section; existing settings toggles unchanged

### 🛡️ Reliability
- Queue state is bound to a single tab through the `aioe_run` URL parameter and a per-tab ownership token, so reloads, restored sessions and other Google tabs cannot corrupt a run
- Each query is stored under its own storage key, so a failure or a slow write never rewrites the whole result set
- Queries without an AI Overview are recorded as `no-overview` (and listed in the popup) instead of aborting the run
- Captcha / `/sorry/` pages pause the run and keep the current queue position for resuming

## [1.0.8] - 2025-12-06

### 🐛 Fixed
- **Auto-expand sources functionality** - Fixed critical issue where sources were not expanding automatically
- **Button selector bug** - Fixed jsaction selector from `^="trigger"` to `*="trigger"` to properly match `jsaction="trigger.Wyhgxe"`
- **Timing issues** - Increased delays for better DOM loading stability (1500ms, 1000ms, 3000ms)
- **Expansion detection logic** - Made `areSourcesExpanded()` more conservative to prevent false positives
- **Button clicking prevention** - Added `buttonClicked` flag to prevent multiple clicking attempts

### 🔧 Changed  
- **Improved selector reliability** - Button detection now works with dynamic Google jsaction attributes
- **Enhanced timing** - Better delays for DOM loading and expansion confirmation
- **Conservative expansion detection** - Higher threshold (8+ links) for considering sources as expanded
- **Preserved +X detection** - Maintained detection for different AI Overview layouts
- **Better debugging** - More detailed logging for troubleshooting button detection

### 🏗️ Technical Improvements
- Fixed `findExpandButtonInLastLi()` selector to use `[jsaction*="trigger"]` instead of `[jsaction^="trigger"]`
- Increased initial delay to 1500ms for sources section loading
- Increased retry delay to 1000ms and observation delay to 3000ms
- Enhanced `areSourcesExpanded()` with `buttonClicked` flag tracking
- Preserved +X button detection for other AI Overview cases
- Added more conservative fallback logic

### ✨ User Experience
- **Reliable source expansion** - "Pokaż wszystko" button now properly detected and clicked
- **No duplicate clicks** - Prevents multiple clicking attempts on the same button
- **Better stability** - More time allowed for DOM elements to load properly
- **Comprehensive logging** - Enhanced debugging information for issue identification

### 🎯 Focus Areas
- **Button detection**: Fixed selector incompatibility with Google's dynamic jsaction attributes
- **Timing optimization**: Better delays for reliable DOM interaction
- **Stability**: Prevention of multiple clicks and false positive detections

## [1.0.7] - 2025-12-06

### 🐛 Fixed
- **Auto-webhook functionality** - Fixed automatic webhook sending after AI overview expansion
- **AI Overview detection** - Improved detection of asynchronously loaded AI overviews
- **ContentExtractor integration** - Fixed webhook data preparation using proper extraction methods
- **Manual button visibility** - Fixed issue where "Extract to Markdown" button was hidden when automation features were enabled

### 🔧 Changed  
- **Default settings** - Auto-expansion features now disabled by default for better user control
- **Enhanced logging** - Added comprehensive debugging logs for troubleshooting
- **Timing improvements** - Added delayed checks to catch AI overviews that load with delay
- **Execution order** - Automation now triggers only after manual button is successfully loaded (sequential flow)

### 🏗️ Technical Improvements
- Fixed `AutoWebhook.prepareWebhookData()` to use `ContentExtractor` and `MarkdownGenerator` instances
- Added proper initialization of extraction modules in `AutoWebhook` constructor
- Enhanced DOM observation with multiple delayed checks (1s, 3s, 5s)
- Improved error handling and status logging throughout the extraction pipeline

### ✨ User Experience
- **Better reliability** - Extension now consistently detects AI overviews regardless of load timing
- **Conservative defaults** - Auto-expansion disabled by default, users can opt-in as needed
- **Improved debugging** - Comprehensive console logging helps identify issues
- **More robust detection** - Multiple detection attempts ensure AI overviews are not missed

### 🎯 Focus Areas
- **Reliability**: Consistent detection and processing of AI overviews
- **User control**: Conservative defaults with easy opt-in for automation features  
- **Debugging**: Enhanced logging for better troubleshooting and development

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2025-06-12

### Added
- **Auto-expand AI overviews feature** - Automatically clicks "Show more" button on collapsed AI overviews
- **Auto-expand sources feature** - Automatically expands collapsed source sections in AI overviews
- **Auto-webhook functionality** - Automatically sends extracted data to configured webhook endpoints
- **Settings management system** - Persistent storage of user preferences using Chrome storage API
- **Extension popup interface** - Modern settings panel accessible from browser toolbar
- **Real-time settings synchronization** - Changes applied immediately across all Google.com tabs
- Toggle switches for auto-expand overviews, auto-expand sources, and auto-webhook functionality
- **Auto-extract on google.com** - Automatically extract and show AI overview content without manual clicking

### Changed
- Extension name updated to "AI Overview Extractor - Features"
- Updated manifest.json to include popup interface and new permissions
- Enhanced content script with message handling for settings communication
- Modularized auto-expand and webhook functionality into separate files

### Technical Details
- Added `SettingsManager` class for settings persistence
- Implemented popup UI with toggle switches and status indicators
- Added automatic detection of collapsed AI overviews using `[aria-expanded="false"][aria-controls="m-x-content"]` selector
- Added automatic detection and expansion of collapsed sources
- Integrated automatic webhook sending when data extraction occurs
- Modular architecture with separate files for different auto-features
- Integrated real-time communication between popup and content scripts

---

## [1.0.5] - 2025-06-10

### Fixed
- Chrome Web Store compliance - removed unnecessary `activeTab` permission
- Improved stability and error handling
- Enhanced source extraction reliability

### Changed
- Code optimization and performance improvements
- Updated all permission justifications and descriptions

---

## [1.0.4] - 2025-06-09

### Added
- Complete English translation - interface and documentation
- Webhook functionality for sending extracted data to external services
- Webhook configuration and testing interface

### Changed
- Enhanced markdown conversion with better formatting
- Improved source link extraction
- Updated button text and user messages
- Code cleanup and improved console messages

---

## [1.0.3] - 2025-06-09

### Added
- Enhanced source extraction from AI overviews
- Better handling of Google URL redirects
- Webhooks - automatic data sending to external APIs
- Webhook configuration UI for URL setup and testing

### Fixed
- Source link cleaning and deduplication
- Improved error handling for edge cases
- Improved content cleaning - removal of CSS, JavaScript and inline styles

### Technical Details
- Chrome Storage for secure configuration storage
- HTTPS validation for webhook security
- Timeout handling with 5s limits
