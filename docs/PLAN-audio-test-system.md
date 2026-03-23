# Plan: Audio Test System

## Context

User request:
- Replace the current audio enable/disable buttons in the home page header with a sound test feature.
- The new feature should let users verify that the announcement system can produce sound.
- Ideally support two language variants for the announcement message:
  - Thai
  - English
- The target spoken message is conceptually:
  - TH: "ขณะนี้กำลังทดสอบเสียงตามสายของระบบ"
  - EN: "The public address system audio test is now in progress."
- There is no final recorded announcement asset yet, so the first release needs a fallback approach.

Constraints observed from current code:
- `frontend/src/pages/Home.tsx` currently renders two icon buttons for `enableAudio()` and `disableAudio()`.
- `frontend/src/context/AlarmsContext.tsx` uses `isAudioEnabled` as a browser audio-unlock state, not as a true product setting.
- Alarm playback currently depends on browser audio permission being unlocked before alarms fire.
- There is no existing TTS feature or dedicated test-audio service abstraction.

Assumptions for planning:
- Phase 1 should avoid waiting for the real voice asset.
- Phase 1 may use browser-native TTS or a temporary beep/sample fallback.
- Existing alarm playback behavior must keep working after UI changes.

## Brainstorm

### Option A: Browser TTS first

Description:
- Add a `Test Sound` action that unlocks audio and speaks a fixed message using browser `speechSynthesis`.
- Let the user choose Thai or English before pressing play.

Pros:
- Fastest path without waiting for recorded files.
- Good for immediate functional verification.
- No backend/storage changes required for the first version.

Cons:
- Voice quality depends on the device/browser.
- Thai voice availability varies by OS.
- Spoken phrasing may sound inconsistent across clients.

Effort:
- Low to Medium

### Option B: Temporary canned audio files

Description:
- Add two bundled temporary audio files, one Thai and one English, and use them for the test button.

Pros:
- Predictable sound across devices.
- Behavior matches real playback more closely.
- No dependency on browser TTS quality.

Cons:
- Blocked because the real audio is not ready yet.
- Requires asset creation before implementation is useful.
- Adds asset/versioning overhead.

Effort:
- Medium

### Option C: Hybrid abstraction

Description:
- Implement one `audio test` flow now, but behind a small abstraction that can use:
  - browser TTS today
  - recorded audio files later
  - simple beep fallback if neither is available

Pros:
- Best long-term structure.
- Avoids reworking UI when the real audio arrives.
- Supports graceful fallback in weak browser environments.

Cons:
- Slightly more design work up front.
- More moving parts than a direct TTS-only implementation.

Effort:
- Medium

## Recommendation

Recommend Option C.

Reasoning:
- The user already knows the final audio content is not ready, so the feature should not depend on that asset.
- The current code already separates UI and playback logic enough that a small playback abstraction is reasonable.
- This approach solves the immediate need, while keeping a clean upgrade path when official Thai/English announcement files are ready.

## Proposed Scope

### Phase 1: Replace UI and unlock audio through test flow

Goals:
- Remove the current enable/disable audio buttons from the alarms header.
- Add a `Test Sound` entry point instead.
- Make the test action also unlock browser audio so future alarms can still play.

UI proposal:
- Replace the two icon buttons with:
  - one primary `Test Sound` button
  - one compact language selector: `TH | EN`
- Show lightweight result text:
  - `Ready`
  - `Testing...`
  - `Playback unavailable`

Notes:
- The product should stop presenting audio as an on/off setting if the real intent is only to confirm playback capability.
- Audio unlock still needs to happen somewhere in the user interaction path; the test button is the correct place.

### Phase 2: Introduce a playback strategy layer

Create a small frontend playback service/hook with this priority:
1. Ensure browser audio is unlocked.
2. If configured test audio asset exists for selected language, play it.
3. Else if browser TTS exists, speak the selected language text.
4. Else play a short beep and show a warning that spoken test audio is unavailable.

Suggested responsibilities:
- `unlockAudio()`
- `playTestAnnouncement(language)`
- `playAlarmAudio(item)`
- normalize success/failure reporting for UI

Why:
- The current `enableAudio()` naming is implementation-driven.
- A playback strategy layer will reduce coupling between:
  - UI controls
  - alarm scheduler
  - future audio assets

### Phase 3: Content and language handling

Need a small message catalog for the test announcement:
- `th`: fixed Thai phrase
- `en`: fixed English phrase

Recommended storage:
- front-end constants first
- migrate to admin-configurable settings only if business later needs editable text

Language UX:
- Keep language selection only for test playback.
- Do not automatically change alarm audio language unless explicitly requested later.

### Phase 4: Swap in real recorded assets later

When the final recordings are ready:
- upload/store two official files
- configure them as preferred test assets
- keep TTS as fallback only

Desired behavior:
- recorded asset wins
- TTS remains backup
- beep remains last-resort diagnostic fallback

## Implementation Breakdown

### Task 1: Audit current audio enable flow

Check:
- where `isAudioEnabled` is read
- how `enableAudio()` affects first alarm playback
- whether scheduler behavior should change when no explicit enable toggle exists

Expected output:
- short decision on whether to keep `isAudioEnabled` internally or rename it to a readiness state

### Task 2: Redesign header controls

Changes:
- remove enable button
- remove disable button
- remove `Audio is disabled` label
- add `Test Sound` control set

Acceptance:
- header stays clean on desktop and mobile
- state is visible during test playback

### Task 3: Build test playback module

Include:
- audio unlock logic
- TTS playback branch
- placeholder beep fallback
- selected language input

Acceptance:
- clicking test triggers audible output when browser permits audio
- user receives clear feedback if spoken output is unavailable

### Task 4: Adapt scheduler compatibility

Changes:
- ensure alarm playback still works after removing manual disable flow
- decide whether alarms should:
  - always attempt playback once audio has been unlocked by any prior user action
  - or fail with a specific status if user never ran test/never interacted

Acceptance:
- no regression in scheduled alarm playback

### Task 5: Add future-ready asset configuration

Prepare for:
- optional test audio file mapping per language
- fallback order definition

Acceptance:
- real assets can be plugged in without redesigning the page

### Task 6: Verification

Verify:
- Chrome desktop
- Edge desktop
- at least one mobile browser if relevant to operations

Test cases:
- test in Thai
- test in English
- test before any alarm fires
- alarm fires after successful test interaction
- no TTS voice available
- offline or slow network if asset playback is enabled later

## Risks

- Browser autoplay restrictions may still block playback until the user clicks something.
- Thai TTS availability is inconsistent across devices.
- If the UI removes the visible enable state, users may not realize that they still need one prior interaction for browser audio permission.
- If recorded files are added later without abstraction, the code will get reworked twice.

## Open Questions

- Should the test feature only confirm sound output, or should it also persist a `ready` state across refreshes?
- Do you want the language selector visible all the time, or inside a small modal/popover opened by `Test Sound`?
- When final voice assets exist, should the system always prefer recorded audio over TTS?
- Is the English sentence fixed, or should operations staff be able to edit the phrase later?

## Suggested Delivery Order

1. Replace UI controls with `Test Sound` and language selector.
2. Reuse existing browser audio unlock behavior from the old enable button.
3. Implement TTS-first playback with beep fallback.
4. Verify scheduled alarms still work after the new interaction.
5. Add optional asset-based test playback hook points.
6. Plug in official TH/EN recordings later.

## Verification Checklist

- The home page no longer shows separate audio on/off controls.
- Users can trigger a manual audio test from the main page.
- Users can choose Thai or English for the test phrase.
- The test action unlocks audio for later alarm playback.
- Alarm playback behavior remains stable after the UI change.
- The system has a defined fallback while real voice files are still unavailable.
