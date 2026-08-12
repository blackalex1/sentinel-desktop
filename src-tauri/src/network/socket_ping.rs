use std::net::ToSocketAddrs;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;

pub async fn measure_tcp_ping(address: &str, port: u16) -> u32 {
    let target = format!("{}:{}", address, port);
    
    // Resolve address asynchronously
    let addr = match target.to_socket_addrs() {
        Ok(mut addrs) => match addrs.next() {
            Some(a) => a,
            None => return 999,
        },
        Err(_) => return 999,
    };

    let start = Instant::now();
    let timeout = Duration::from_millis(3000);

    match tokio::time::timeout(timeout, TcpStream::connect(addr)).await {
        Ok(Ok(_)) => {
            let elapsed = start.elapsed().as_millis() as u32;
            std::cmp::max(elapsed, 1)
        }
        _ => 999, // Timeout or error
    }
}
