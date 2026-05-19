#[cfg(windows)]
mod win {
    use crate::platform::windows::ipc_dispatch::handle_connection;
    use tokio::io::split;
    use tokio::net::windows::named_pipe::ServerOptions;

    pub async fn run_pipe_acceptor(pipe_name: &'static str, allow_desktop: bool) -> std::io::Result<()> {
        loop {
            let server = ServerOptions::new().create(pipe_name)?;
            server.connect().await?;
            let (r, w) = split(server);
            handle_connection(allow_desktop, r, w).await;
        }
    }
}

#[cfg(windows)]
pub async fn run_svc_pipe_forever() -> std::io::Result<()> {
    win::run_pipe_acceptor(crate::platform::windows::ipc::PIPE_SVC, false).await
}

#[cfg(windows)]
pub async fn run_user_pipe_forever() -> std::io::Result<()> {
    win::run_pipe_acceptor(crate::platform::windows::ipc::PIPE_USER, true).await
}
