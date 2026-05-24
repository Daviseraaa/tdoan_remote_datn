//! Chrome Native Messaging: 4-byte LE length + UTF-8 JSON on stdin/stdout.

use std::io::{self, Read, Write};

pub fn read_message<R: Read>(r: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut len_buf = [0u8; 4];
    match r.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_le_bytes(len_buf) as usize;
    if len == 0 {
        return Ok(Some(Vec::new()));
    }
    if len > 4 * 1024 * 1024 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("message too large: {len}"),
        ));
    }
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)?;
    Ok(Some(buf))
}

pub fn write_message<W: Write>(w: &mut W, body: &[u8]) -> io::Result<()> {
    let len = body.len().min(u32::MAX as usize) as u32;
    w.write_all(&len.to_le_bytes())?;
    w.write_all(body)?;
    w.flush()?;
    Ok(())
}
