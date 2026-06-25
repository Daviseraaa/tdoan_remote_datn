use std::cell::RefCell;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Accessibility::{CUIAutomation, IUIAutomation};

thread_local! {
    static AUTOMATION: RefCell<Option<IUIAutomation>> = const { RefCell::new(None) };
}

fn create_automation() -> Result<IUIAutomation, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("CoCreateInstance(CUIAutomation): {e}"))
    }
}

/// Instance UIA tái sử dụng theo thread — tránh CoCreateInstance mỗi lần capture.
pub fn automation() -> Result<IUIAutomation, String> {
    AUTOMATION.with(|cell| {
        let mut slot = cell.borrow_mut();
        if let Some(ref cached) = *slot {
            return Ok(cached.clone());
        }
        let instance = create_automation()?;
        *slot = Some(instance.clone());
        Ok(instance)
    })
}
