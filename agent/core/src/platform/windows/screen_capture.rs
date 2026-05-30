//! Chụp màn hình (monitor index) → PNG bytes.

use screenshots::image::ImageFormat;
use screenshots::Screen;

pub fn capture_monitor_png(monitor: usize) -> Result<(Vec<u8>, u32, u32), String> {
    let screens = Screen::all().map_err(|e| format!("Screen::all: {}", e))?;
    let screen = screens
        .into_iter()
        .nth(monitor)
        .ok_or_else(|| format!("Không có màn hình index {}", monitor))?;
    let image = screen
        .capture()
        .map_err(|e| format!("capture: {}", e))?;
    let w = image.width();
    let h = image.height();
    let mut png = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png);
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("encode png: {}", e))?;
    Ok((png, w, h))
}
