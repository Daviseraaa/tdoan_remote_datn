#[cfg(windows)]
use std::ffi::OsString;
#[cfg(windows)]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(windows)]
use std::sync::Arc;
#[cfg(windows)]
use std::time::Duration;
#[cfg(windows)]
use windows_service::service::{
    ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus, ServiceType,
};
#[cfg(windows)]
use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
#[cfg(windows)]
use windows_service::{define_windows_service, service_dispatcher};

/// Khớp `agent/desktop/src/service/native-windows-service.ts` — `sc create StationHubAgentNative ...`
#[cfg(windows)]
const SERVICE_NAME: &str = "StationHubAgentNative";

#[cfg(windows)]
define_windows_service!(ffi_service_main, service_main);

#[cfg(windows)]
pub fn run() -> windows_service::Result<()> {
    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
}

#[cfg(windows)]
fn service_main(_arguments: Vec<OsString>) {
    let stop = Arc::new(AtomicBool::new(false));
    let stop2 = stop.clone();

    let event_handler = move |control| -> ServiceControlHandlerResult {
        match control {
            ServiceControl::Stop => {
                stop2.store(true, Ordering::SeqCst);
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    let status_handle = match service_control_handler::register(SERVICE_NAME, event_handler) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("[service] register handler failed: {}", e);
            return;
        }
    };

    let _ = status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    });

    let rt = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[service] tokio runtime: {}", e);
            let _ = status_handle.set_service_status(ServiceStatus {
                service_type: ServiceType::OWN_PROCESS,
                current_state: ServiceState::Stopped,
                controls_accepted: ServiceControlAccept::empty(),
                exit_code: ServiceExitCode::Win32(1),
                checkpoint: 0,
                wait_hint: Duration::default(),
                process_id: None,
            });
            return;
        }
    };

    let stop_rt = stop.clone();
    if let Err(e) = rt.block_on(crate::connection::runner::run_with_stop(stop_rt)) {
        eprintln!("[service] agent ended: {}", e);
    }

    let _ = status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    });
}
