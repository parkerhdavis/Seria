/**
 * CSV Diff Module
 *
 * Compares two CSV files and returns a structured diff result.
 * Uses a simple row-by-row comparison with LCS-inspired matching
 * to detect added, deleted, and modified rows.
 */
use serde::{Deserialize, Serialize};

/// Represents a single cell that was modified between two files
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModifiedCell {
    pub row: usize,
    pub col: usize,
    pub old_value: String,
    pub new_value: String,
}

/// Represents column-level changes between two files
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColumnChanges {
    pub added: Vec<String>,
    pub deleted: Vec<String>,
}

/// The complete diff result between two CSV files
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub added_rows: Vec<usize>,
    pub deleted_rows: Vec<usize>,
    pub modified_cells: Vec<ModifiedCell>,
    pub column_changes: ColumnChanges,
    pub old_headers: Vec<String>,
    pub new_headers: Vec<String>,
    pub old_data: Vec<Vec<String>>,
    pub new_data: Vec<Vec<String>>,
    pub old_row_count: usize,
    pub new_row_count: usize,
}

/// Parse a CSV string into headers and data rows
fn parse_csv_content(content: &str) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let mut lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Ok((vec![], vec![]));
    }

    // Parse header line
    let headers = parse_csv_line(lines.remove(0))?;

    // Parse data lines
    let mut data = Vec::new();
    for line in &lines {
        if line.trim().is_empty() {
            continue;
        }
        let row = parse_csv_line(line)?;
        data.push(row);
    }

    Ok((headers, data))
}

/// Parse a single CSV line respecting quoted fields
fn parse_csv_line(line: &str) -> Result<Vec<String>, String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    // Escaped quote
                    current.push('"');
                    chars.next();
                } else {
                    // End of quoted field
                    in_quotes = false;
                }
            } else {
                current.push(c);
            }
        } else if c == '"' {
            in_quotes = true;
        } else if c == ',' {
            fields.push(current.clone());
            current.clear();
        } else {
            current.push(c);
        }
    }
    fields.push(current);

    Ok(fields)
}

/// Compute hash for a row to enable fast comparison
fn row_hash(row: &[String]) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    for cell in row {
        cell.hash(&mut hasher);
    }
    hasher.finish()
}

/// LCS-based row matching to find the best alignment between old and new data.
/// Returns pairs of (old_index, new_index) for matched rows.
/// Uses two-pass matching: first exact LCS match, then first-column (ID) matching
/// for modified rows.
fn find_row_matches(old_data: &[Vec<String>], new_data: &[Vec<String>]) -> Vec<(usize, usize)> {
    let old_len = old_data.len();
    let new_len = new_data.len();

    // For very large files, use hash-based matching for performance
    if old_len > 5000 || new_len > 5000 {
        return hash_based_matching(old_data, new_data);
    }

    // Build LCS table for exact row matches
    let mut dp = vec![vec![0u32; new_len + 1]; old_len + 1];

    // Pre-compute row hashes for faster comparison
    let old_hashes: Vec<u64> = old_data.iter().map(|r| row_hash(r)).collect();
    let new_hashes: Vec<u64> = new_data.iter().map(|r| row_hash(r)).collect();

    for i in 1..=old_len {
        for j in 1..=new_len {
            if old_hashes[i - 1] == new_hashes[j - 1] && old_data[i - 1] == new_data[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find exact matches
    let mut matches = Vec::new();
    let mut i = old_len;
    let mut j = new_len;

    while i > 0 && j > 0 {
        if old_hashes[i - 1] == new_hashes[j - 1] && old_data[i - 1] == new_data[j - 1] {
            matches.push((i - 1, j - 1));
            i -= 1;
            j -= 1;
        } else if dp[i - 1][j] > dp[i][j - 1] {
            i -= 1;
        } else {
            j -= 1;
        }
    }

    matches.reverse();

    // Second pass: match remaining rows by first column value (ID column)
    // This catches modified rows that share the same ID but differ in other columns
    let matched_old: std::collections::HashSet<usize> = matches.iter().map(|&(o, _)| o).collect();
    let matched_new: std::collections::HashSet<usize> = matches.iter().map(|&(_, n)| n).collect();

    let mut id_matches: Vec<(usize, usize)> = Vec::new();
    let mut used_new: std::collections::HashSet<usize> = matched_new;

    for (old_idx, old_row) in old_data.iter().enumerate() {
        if matched_old.contains(&old_idx) {
            continue;
        }
        let old_id = old_row.first().map(|s| s.as_str()).unwrap_or("");
        if old_id.is_empty() {
            continue;
        }

        for (new_idx, new_row) in new_data.iter().enumerate() {
            if used_new.contains(&new_idx) {
                continue;
            }
            let new_id = new_row.first().map(|s| s.as_str()).unwrap_or("");
            if old_id == new_id {
                id_matches.push((old_idx, new_idx));
                used_new.insert(new_idx);
                break;
            }
        }
    }

    // Merge exact matches and ID matches, sorted by old index
    matches.extend(id_matches);
    matches.sort_by_key(|&(o, _)| o);
    matches
}

/// Hash-based matching for large files - matches rows by exact content
fn hash_based_matching(old_data: &[Vec<String>], new_data: &[Vec<String>]) -> Vec<(usize, usize)> {
    use std::collections::HashMap;

    // Build a map from row hash to indices in old data
    let mut old_map: HashMap<u64, Vec<usize>> = HashMap::new();
    for (i, row) in old_data.iter().enumerate() {
        old_map.entry(row_hash(row)).or_default().push(i);
    }

    let mut matches = Vec::new();
    let mut used_old: std::collections::HashSet<usize> = std::collections::HashSet::new();

    for (j, new_row) in new_data.iter().enumerate() {
        let h = row_hash(new_row);
        if let Some(old_indices) = old_map.get(&h) {
            for &old_idx in old_indices {
                if !used_old.contains(&old_idx) && old_data[old_idx] == *new_row {
                    matches.push((old_idx, j));
                    used_old.insert(old_idx);
                    break;
                }
            }
        }
    }

    matches.sort_by_key(|&(a, _)| a);
    matches
}

/// Compare two CSV file contents and produce a diff result
#[tauri::command]
pub fn compare_csv_files(old_content: String, new_content: String) -> Result<DiffResult, String> {
    let (old_headers, old_data) = parse_csv_content(&old_content)
        .map_err(|e| format!("Failed to parse first file: {}", e))?;
    let (new_headers, new_data) = parse_csv_content(&new_content)
        .map_err(|e| format!("Failed to parse second file: {}", e))?;

    // Detect column changes
    let added_cols: Vec<String> = new_headers
        .iter()
        .filter(|h| !old_headers.contains(h))
        .cloned()
        .collect();
    let deleted_cols: Vec<String> = old_headers
        .iter()
        .filter(|h| !new_headers.contains(h))
        .cloned()
        .collect();

    // Find matching rows using LCS
    let row_matches = find_row_matches(&old_data, &new_data);

    // Determine deleted rows (old rows not in matches)
    let matched_old: std::collections::HashSet<usize> =
        row_matches.iter().map(|&(o, _)| o).collect();
    let deleted_rows: Vec<usize> = (0..old_data.len())
        .filter(|i| !matched_old.contains(i))
        .collect();

    // Determine added rows (new rows not in matches)
    let matched_new: std::collections::HashSet<usize> =
        row_matches.iter().map(|&(_, n)| n).collect();
    let added_rows: Vec<usize> = (0..new_data.len())
        .filter(|i| !matched_new.contains(i))
        .collect();

    // Find modified cells in matched rows
    // Map common columns between old and new headers
    let mut modified_cells = Vec::new();
    for &(old_idx, new_idx) in &row_matches {
        let old_row = &old_data[old_idx];
        let new_row = &new_data[new_idx];

        // Compare cells for columns that exist in both
        for (new_col_idx, new_header) in new_headers.iter().enumerate() {
            if let Some(old_col_idx) = old_headers.iter().position(|h| h == new_header) {
                let old_val = old_row.get(old_col_idx).map(|s| s.as_str()).unwrap_or("");
                let new_val = new_row.get(new_col_idx).map(|s| s.as_str()).unwrap_or("");

                if old_val != new_val {
                    modified_cells.push(ModifiedCell {
                        row: new_idx,
                        col: new_col_idx,
                        old_value: old_val.to_string(),
                        new_value: new_val.to_string(),
                    });
                }
            }
        }
    }

    let old_row_count = old_data.len();
    let new_row_count = new_data.len();

    Ok(DiffResult {
        added_rows,
        deleted_rows,
        modified_cells,
        column_changes: ColumnChanges {
            added: added_cols,
            deleted: deleted_cols,
        },
        old_headers,
        new_headers,
        old_data,
        new_data,
        old_row_count,
        new_row_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_files() {
        let content = "id,name\n1,Alice\n2,Bob";
        let result = compare_csv_files(content.to_string(), content.to_string()).unwrap();
        assert!(result.added_rows.is_empty());
        assert!(result.deleted_rows.is_empty());
        assert!(result.modified_cells.is_empty());
    }

    #[test]
    fn test_added_row() {
        let old = "id,name\n1,Alice\n2,Bob";
        let new = "id,name\n1,Alice\n2,Bob\n3,Charlie";
        let result = compare_csv_files(old.to_string(), new.to_string()).unwrap();
        assert_eq!(result.added_rows, vec![2]);
        assert!(result.deleted_rows.is_empty());
        assert!(result.modified_cells.is_empty());
    }

    #[test]
    fn test_deleted_row() {
        let old = "id,name\n1,Alice\n2,Bob\n3,Charlie";
        let new = "id,name\n1,Alice\n3,Charlie";
        let result = compare_csv_files(old.to_string(), new.to_string()).unwrap();
        assert!(result.added_rows.is_empty());
        assert_eq!(result.deleted_rows, vec![1]);
        assert!(result.modified_cells.is_empty());
    }

    #[test]
    fn test_modified_cell() {
        let old = "id,name\n1,Alice\n2,Bob";
        let new = "id,name\n1,Alice\n2,Robert";
        let result = compare_csv_files(old.to_string(), new.to_string()).unwrap();
        assert!(result.added_rows.is_empty());
        assert!(result.deleted_rows.is_empty());
        assert_eq!(result.modified_cells.len(), 1);
        assert_eq!(result.modified_cells[0].old_value, "Bob");
        assert_eq!(result.modified_cells[0].new_value, "Robert");
    }

    #[test]
    fn test_column_changes() {
        let old = "id,name,age\n1,Alice,30";
        let new = "id,name,email\n1,Alice,alice@example.com";
        let result = compare_csv_files(old.to_string(), new.to_string()).unwrap();
        assert_eq!(result.column_changes.added, vec!["email"]);
        assert_eq!(result.column_changes.deleted, vec!["age"]);
    }
}
