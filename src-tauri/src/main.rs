#![cfg_attr(  
    all(not(debug_assertions), target_os = "windows"),  
    windows_subsystem = "windows"  
)]  
  
use tauri::{Manager, Window};  
use tauri::api::process::{Command, CommandEvent};  
use std::thread;  
use std::time::Duration;
use std::collections::HashMap;  

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
    
    // Set environment variables for the server
    let mut env_vars = HashMap::new();
    env_vars.insert("NODE_ENV".to_string(), "production".to_string());
    env_vars.insert("PORT".to_string(), "3000".to_string());
    env_vars.insert("WORLD".to_string(), "world".to_string());
    env_vars.insert("PUBLIC_ASSETS_URL".to_string(), "".to_string());
    
    println!("Starting server with path: {:?}", server_path);
    
    if !server_path.exists() {
        return Err(format!("Server file not found at: {:?}", server_path));
    }
    
    let mut command = Command::new_sidecar("node")
        .expect("failed to create `node` binary command");
    
    // Add environment variables
    command = command.envs(env_vars);
    
    let (mut rx, _child) = command
        .args([server_path.to_str().unwrap()])
        .spawn()  
        .expect("Failed to spawn sidecar");  

    println!("Node.js sidecar spawned successfully");

    // Spawn a thread to monitor the sidecar output
    let window_clone = window.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    println!("Node.js stdout: {}", line);
                    let _ = window_clone.eval(&format!("console.log('Node.js: {}')", line));
                }
                CommandEvent::Stderr(line) => {
                    println!("Node.js stderr: {}", line);
                    let _ = window_clone.eval(&format!("console.error('Node.js error: {}')", line));
                }
                CommandEvent::Terminated(payload) => {
                    println!("Node.js process terminated: {:?}", payload);
                    let _ = window_clone.eval(&format!("console.error('Node.js terminated: {:?}')", payload));
                }
                _ => {}
            }
        }
    });

    // Wait for server to start with timeout
    let mut attempts = 0;
    let max_attempts = 30; // 30 seconds timeout
    
    while attempts < max_attempts {
        thread::sleep(Duration::from_secs(1));
        attempts += 1;
        
        // Check if server is responding
        match reqwest::get("http://localhost:3000").await {
            Ok(response) => {
                if response.status().is_success() {
                    println!("Server is responding on port 3000");
                    break;
                }
            }
            Err(_) => {
                // Server not responding yet, but process is still running
                if attempts % 5 == 0 {
                    println!("Server process running, waiting for HTTP response... (attempt {}/{})", attempts, max_attempts);
                }
            }
        }
    }
    
    if attempts >= max_attempts {
        println!("Timeout reached, but Node.js process is still running. Proceeding anyway...");
        // Don't fail completely - the process might be running but just slow to respond
    }
      
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
            let window_clone = window.clone();
            tauri::async_runtime::spawn(async move {  
                let result = start_server(window_clone.clone()).await;
                match result {
                    Ok(_) => {
                        println!("Server started successfully");
                    }
                    Err(e) => {
                        println!("Failed to start server: {}", e);
                        // Show error in the window
                        let _ = window_clone.eval(&format!("alert('Server startup failed: {}')", e));
                    }
                }
            });  
              
            Ok(())  
        })  
        .run(tauri::generate_context!())  
        .expect("error while running tauri application");  
}