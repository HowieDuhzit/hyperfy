#![cfg_attr(  
    all(not(debug_assertions), target_os = "windows"),  
    windows_subsystem = "windows"  
)]  
  
use tauri::{Manager, Window};  
use tauri::api::process::Command;  
use std::thread;  
use std::time::Duration;  

#[tauri::command]  
async fn start_server(window: Window) -> Result<(), String> {  
    // Start the server using bundled Node.js  
    let server_path = std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .join("resources")
        .join("build")
        .join("index.js");
    
    let (_rx, _child) = Command::new_sidecar("node")  
        .expect("failed to create `node` binary command")  
        .args([server_path.to_str().unwrap()])
        .spawn()  
        .expect("Failed to spawn sidecar");  

    // Wait for server to start  
    thread::sleep(Duration::from_secs(3));  
      
    // Navigate to the local server  
    let _ = window.eval("window.location.href = 'http://localhost:3000'");  
      
    Ok(())  
}  
  
fn main() {  
    tauri::Builder::default()  
        .invoke_handler(tauri::generate_handler![start_server])  
        .setup(|app| {  
            let window = app.get_window("main").unwrap();  
              
            // Start the server when the app launches  
            tauri::async_runtime::spawn(async move {  
                let _ = start_server(window).await;  
            });  
              
            Ok(())  
        })  
        .run(tauri::generate_context!())  
        .expect("error while running tauri application");  
}