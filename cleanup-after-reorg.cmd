@echo off
REM One-time cleanup after the Sept 12 2026 reorg. The files below were MOVED
REM (floor code into app\floor, lib\clover.ts into app\lib) but the old copies
REM could not be deleted remotely. Nothing imports them any more. Run this
REM once from the project root, then delete it (it deletes itself at the end).
cd /d "%~dp0"

del /q "app\ProductionTracker.jsx"
del /q "app\screens\BatchesScreen.jsx"
del /q "app\screens\InventoryScreen.jsx"
del /q "app\screens\SettingsScreen.jsx"
del /q "app\screens\TasksScreen.jsx"
del /q "app\components\ItemModal.jsx"
del /q "app\components\LocationSetting.jsx"
del /q "app\lib\store.js"
del /q "app\lib\approval.jsx"
del /q "app\lib\companyRoster.jsx"
del /q "app\lib\deviceLocation.jsx"
del /q "app\lib\sharedStations.js"
del /q "lib\clover.ts"
REM ui.jsx was split into app\components\ui\ (one file per component,
REM barrelled by ui\index.ts) and then converted to TypeScript. The old
REM ui.jsx is a forwarding shim, and the .jsx/.js files below are the
REM pre-TypeScript copies. Next resolves .ts/.tsx first, so all of these
REM are already inert; this just takes them off disk.
del /q "app\components\ui.jsx"
del /q "app\components\ui\Badge.jsx"
del /q "app\components\ui\Button.jsx"
del /q "app\components\ui\Card.jsx"
del /q "app\components\ui\Dropdown.jsx"
del /q "app\components\ui\EmptyState.jsx"
del /q "app\components\ui\Field.jsx"
del /q "app\components\ui\Input.jsx"
del /q "app\components\ui\MetaRow.jsx"
del /q "app\components\ui\Modal.jsx"
del /q "app\components\ui\Popover.jsx"
del /q "app\components\ui\ProgressBar.jsx"
del /q "app\components\ui\RowActions.jsx"
del /q "app\components\ui\ScreenToolbar.jsx"
del /q "app\components\ui\ScrollArea.jsx"
del /q "app\components\ui\SearchInput.jsx"
del /q "app\components\ui\SectionHeading.jsx"
del /q "app\components\ui\Segmented.jsx"
del /q "app\components\ui\Skeleton.jsx"
del /q "app\components\ui\Slot.jsx"
del /q "app\components\ui\StatCard.jsx"
del /q "app\components\ui\StickyFadeHeader.jsx"
del /q "app\components\ui\Switch.jsx"
del /q "app\components\ui\Toast.jsx"
del /q "app\components\ui\Tooltip.jsx"
del /q "app\components\ui\cx.js"
del /q "app\components\ui\floating.js"
del /q "app\components\ui\scroll.js"
del /q "app\components\ui\index.js"
del /q "app\globals.css.pre-notion"
del /q "src-stage.tgz"

rmdir "app\screens" 2>nul
rmdir "lib" 2>nul
rmdir "app\company\feedback" 2>nul
rmdir "app\company\settings" 2>nul

echo Done. Old copies removed.
del /q "%~f0"
