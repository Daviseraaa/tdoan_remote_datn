use async_trait::async_trait;
use calamine::{open_workbook_auto, Data, Reader};
use rust_xlsxwriter::Workbook;
use serde_json::{json, Map, Value};
use std::path::Path;

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

fn cell_to_json(cell: Data) -> Value {
    match cell {
        Data::Int(i) => json!(i),
        Data::Float(f) => json!(f),
        Data::String(s) => json!(s),
        Data::Bool(b) => json!(b),
        Data::DateTime(f) => json!(f.to_string()),
        Data::DateTimeIso(s) => json!(s),
        Data::DurationIso(s) => json!(s),
        Data::Error(e) => json!(format!("{e:?}")),
        Data::Empty => Value::Null,
    }
}

fn read_excel(payload: &Value) -> Result<Value, String> {
    let path = payload
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "path required".to_string())?;
    let has_header = payload
        .get("hasHeader")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let sheet_opt = payload
        .get("sheet")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    let names = workbook.sheet_names().to_vec();
    if names.is_empty() {
        return Err("workbook has no sheets".into());
    }
    let sheet_name = sheet_opt.unwrap_or_else(|| names[0].clone());
    if !names.iter().any(|n| n == &sheet_name) {
        return Err(format!("sheet not found: {sheet_name}"));
    }

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| e.to_string())?;

    let mut rows_iter = range.rows();
    let mut headers: Vec<String> = Vec::new();
    let mut rows: Vec<Value> = Vec::new();

    if has_header {
        if let Some(header_row) = rows_iter.next() {
            headers = header_row
                .iter()
                .enumerate()
                .map(|(i, c)| {
                    let s = c.to_string();
                    if s.is_empty() {
                        format!("col_{}", i + 1)
                    } else {
                        s
                    }
                })
                .collect();
        }
    }

    for row in rows_iter {
        if has_header && !headers.is_empty() {
            let mut obj = Map::new();
            for (i, cell) in row.iter().enumerate() {
                let key = headers
                    .get(i)
                    .cloned()
                    .unwrap_or_else(|| format!("col_{}", i + 1));
                obj.insert(key, cell_to_json(cell.clone()));
            }
            rows.push(Value::Object(obj));
        } else {
            let arr: Vec<Value> = row.iter().map(|c| cell_to_json(c.clone())).collect();
            rows.push(Value::Array(arr));
        }
    }

    Ok(json!({
        "path": path,
        "sheet": sheet_name,
        "headers": headers,
        "rows": rows,
        "rowCount": rows.len(),
    }))
}

fn write_cell(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    row: u32,
    col: u16,
    value: &Value,
) -> Result<(), String> {
    match value {
        Value::Null => {}
        Value::Bool(b) => {
            worksheet
                .write_boolean(row, col, *b)
                .map_err(|e| e.to_string())?;
        }
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                worksheet
                    .write_number(row, col, i as f64)
                    .map_err(|e| e.to_string())?;
            } else if let Some(f) = n.as_f64() {
                worksheet
                    .write_number(row, col, f)
                    .map_err(|e| e.to_string())?;
            }
        }
        Value::String(s) => {
            worksheet
                .write_string(row, col, s)
                .map_err(|e| e.to_string())?;
        }
        other => {
            worksheet
                .write_string(row, col, &other.to_string())
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn write_excel(payload: &Value) -> Result<Value, String> {
    let path = payload
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "path required".to_string())?;
    let sheet = payload
        .get("sheet")
        .and_then(|v| v.as_str())
        .unwrap_or("Sheet1");
    let data = payload.get("data").ok_or_else(|| "data required".to_string())?;

    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name(sheet).map_err(|e| e.to_string())?;

    let mut row_idx = 0u32;
    let mut rows_written = 0u32;

    match data {
        Value::Object(obj)
            if obj.get("headers").is_some() && obj.get("rows").is_some() =>
        {
            let headers = obj
                .get("headers")
                .and_then(|v| v.as_array())
                .ok_or_else(|| "invalid headers".to_string())?;
            for (i, h) in headers.iter().enumerate() {
                write_cell(worksheet, row_idx, i as u16, h)?;
            }
            row_idx += 1;
            let body = obj
                .get("rows")
                .and_then(|v| v.as_array())
                .ok_or_else(|| "invalid rows".to_string())?;
            for row in body {
                if let Value::Array(cells) = row {
                    for (i, c) in cells.iter().enumerate() {
                        write_cell(worksheet, row_idx, i as u16, c)?;
                    }
                } else if let Value::Object(map) = row {
                    for (i, h) in headers.iter().enumerate() {
                        let key = h.as_str().unwrap_or("");
                        let val = map.get(key).unwrap_or(&Value::Null);
                        write_cell(worksheet, row_idx, i as u16, val)?;
                    }
                }
                row_idx += 1;
                rows_written += 1;
            }
        }
        Value::Array(items) if !items.is_empty() => {
            if let Value::Object(first) = &items[0] {
                let keys: Vec<String> = first.keys().cloned().collect();
                for (i, k) in keys.iter().enumerate() {
                    worksheet
                        .write_string(0, i as u16, k)
                        .map_err(|e| e.to_string())?;
                }
                row_idx = 1;
                for item in items {
                    if let Value::Object(map) = item {
                        for (i, k) in keys.iter().enumerate() {
                            let val = map.get(k).unwrap_or(&Value::Null);
                            write_cell(worksheet, row_idx, i as u16, val)?;
                        }
                        row_idx += 1;
                        rows_written += 1;
                    }
                }
            } else {
                for item in items {
                    if let Value::Array(cells) = item {
                        for (i, c) in cells.iter().enumerate() {
                            write_cell(worksheet, row_idx, i as u16, c)?;
                        }
                        row_idx += 1;
                        rows_written += 1;
                    }
                }
            }
        }
        _ => return Err("data must be array of objects or {headers, rows}".into()),
    }

    workbook.save(path).map_err(|e| e.to_string())?;

    Ok(json!({
        "path": path,
        "sheet": sheet,
        "rowsWritten": rows_written,
    }))
}

fn resolve_operation(task: &TaskExecute, payload: &Value) -> String {
    if let Some(op) = payload.get("operation").and_then(|v| v.as_str()) {
        return op.to_string();
    }
    if !task.command.is_empty() {
        return task.command.clone();
    }
    String::new()
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "FILE_OPERATION"
    }

    async fn run(&self, _ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let payload = match &task.payload {
            Some(p) => p,
            None => {
                return (
                    false,
                    -1,
                    Some("FILE_OPERATION requires payload".into()),
                    None,
                );
            }
        };

        let op = resolve_operation(task, payload);
        let result = match op.as_str() {
            "read_excel" => read_excel(payload),
            "write_excel" => write_excel(payload),
            _ => Err(format!("unsupported FILE_OPERATION: {op}")),
        };

        match result {
            Ok(v) => (true, 0, None, Some(v)),
            Err(e) => (false, -1, Some(e), None),
        }
    }
}
