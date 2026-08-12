use crate::network::socket_ping::measure_tcp_ping;

#[tauri::command]
pub async fn ping_server(address: String, port: u16) -> Result<u32, String> {
    let latency = measure_tcp_ping(&address, port).await;
    Ok(latency)
}
