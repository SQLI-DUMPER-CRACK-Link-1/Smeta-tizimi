# Goal Description
Fix the F2 calculation bug in Google Sheets, add a category selection dropdown in the F2 Import UI, and move the F2 Import execution into the background queue system to prevent 6-minute timeouts.

## User Review Required
None of these changes are breaking changes. They add required functionality and fix existing bugs.

## Proposed Changes

### 10_Engine.js
- Modify `_f2sum` function to wrap `MOD(COLUMN(...))` in `ARRAYFORMULA` so that the `FILTER` function can correctly evaluate the array condition. The current omission of `ARRAYFORMULA` is causing the formula to fail and return `0`.

### Panel.html
- **F2 Category Select UI**: In `f2ChapChiz()`, add a `<select>` dropdown for resource nodes (`rs`, `mat`, `ob`) to let the user manually override the type (МАТ, МАШ, ЧЕЛ, ОБ).
- **F2 Queue Submission**: Update `f2Qolla()` to call the new `apiF2QollaNavbatga` function instead of directly waiting for `apiF2Qolla` to complete. Display a success toast that the task is queued, allowing the user to close the modal immediately.

### 50_Navbat.js
- Enhance `_navbatIshlaBitta()` to recognize a new task type `f2_qolla`.
- When processing `f2_qolla`, call the existing `apiF2Qolla` function with the provided payload (`oyNom`, `edits`, `dopps`).

### 30_Panel.js
- Expose the new `apiF2QollaNavbatga` function.
- This function will serialize the `edits` and `dopps` and push them into the queue using `_navbatgaQosh`.

## Verification Plan
### Automated Tests
- Check syntax using `node -c`.

### Manual Verification
- Deploy to Google Apps Script.
- The user will check if existing and new F2 columns correctly sum up.
- The user will test the dropdown to classify a resource in F2 Import.
- The user will test F2 Import submission and observe the background task execution in the Boss panel.
