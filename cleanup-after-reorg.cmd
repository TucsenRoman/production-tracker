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
del /q "app\globals.css.pre-notion"
del /q "src-stage.tgz"

rmdir "app\screens" 2>nul
rmdir "lib" 2>nul
rmdir "app\company\feedback" 2>nul
rmdir "app\company\settings" 2>nul

echo Done. Old copies removed.
del /q "%~f0"
