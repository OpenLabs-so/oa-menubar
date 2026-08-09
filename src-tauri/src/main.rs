// Prevents an extra console window on Windows in release. The app is
// macOS-first, but the attribute costs nothing and keeps the template honest.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    getopen_menubar_lib::run()
}
