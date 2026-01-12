/**
 * Screenplay to CSV Converter
 *
 * Parses plain text screenplay format and converts it to CSV with two columns:
 * - Type: The element type (Scene, Action, Character, Parenthetical, Dialogue, Transition)
 * - Content: The text content of the element
 *
 * Screenplay format uses indentation to denote element types:
 * - Scene: 0 indent, ALL CAPS, starts with INT./EXT.
 * - Action: 0 indent, regular case
 * - Character: ~20-25 spaces indent, ALL CAPS
 * - Parenthetical: ~15-20 spaces indent, (in parentheses)
 * - Dialogue: ~10-15 spaces indent, regular case
 * - Transition: ~55+ spaces indent, ALL CAPS, often ends with ":"
 */
use serde::{Deserialize, Serialize};

/// Element types in a screenplay
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ElementType {
    Scene,
    Action,
    Character,
    Parenthetical,
    Dialogue,
    Transition,
}

/// A parsed screenplay element
#[derive(Debug, Clone)]
struct ScreenplayElement {
    element_type: ElementType,
    content: String,
}

/// Convert screenplay text content to CSV format
///
/// # Arguments
/// * `content` - The plain text screenplay content
///
/// # Returns
/// * `Result<String, String>` - CSV-formatted string or error message
///
/// # CSV Format
/// The output has 6 columns: Transition, Scene, Action, Character, Parenthetical, Dialogue
///
/// # Example CSV Output
/// ```csv
/// Transition,Scene,Action,Character,Parenthetical,Dialogue
/// FADE IN,INT. OFFICE - DAY,,,,
/// ,,John enters the room.,,,
/// ,,,JOHN,,"Hello, everyone!"
/// ,,,MARY,(smiling),"Hi, John."
/// ```
#[tauri::command]
pub fn convert_screenplay_to_csv(content: String) -> Result<String, String> {
    let elements = parse_screenplay(&content)?;
    let csv = elements_to_csv(&elements);
    Ok(csv)
}

/// Convert CSV format back to screenplay text
///
/// # Arguments
/// * `csv_content` - CSV content with Transition, Scene, Action, Character, Parenthetical, Dialogue columns
///
/// # Returns
/// * `Result<String, String>` - Formatted screenplay text or error message
#[tauri::command]
pub fn convert_csv_to_screenplay(csv_content: String) -> Result<String, String> {
    let elements = parse_csv_to_elements(&csv_content)?;
    let screenplay = elements_to_screenplay(&elements);
    Ok(screenplay)
}

/// Parse screenplay text into structured elements
fn parse_screenplay(content: &str) -> Result<Vec<ScreenplayElement>, String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut elements = Vec::new();
    let mut current_element: Option<ScreenplayElement> = None;
    let mut prev_type: Option<ElementType> = None;

    for line in lines {
        // Skip empty lines, but they can terminate current element
        if line.trim().is_empty() {
            if let Some(elem) = current_element.take() {
                prev_type = Some(elem.element_type);
                elements.push(elem);
            }
            continue;
        }

        // For classification, use the current element's type if available
        let context_type = current_element
            .as_ref()
            .map(|e| e.element_type)
            .or(prev_type);

        // Classify the line
        let line_type = classify_line(line, context_type);

        // Check if we should continue the current element or start a new one
        match &mut current_element {
            Some(elem) if elem.element_type == line_type && can_continue(line_type) => {
                // Continue current element (multi-line action or dialogue)
                elem.content.push(' ');
                elem.content.push_str(line.trim());
            }
            Some(elem) => {
                // Different type, push current and start new
                let elem_type = elem.element_type;
                elements.push(elem.clone());
                prev_type = Some(elem_type); // Update prev_type after pushing
                current_element = Some(ScreenplayElement {
                    element_type: line_type,
                    content: line.trim().to_string(),
                });
            }
            None => {
                // Start new element
                current_element = Some(ScreenplayElement {
                    element_type: line_type,
                    content: line.trim().to_string(),
                });
            }
        }
    }

    // Push final element if any
    if let Some(elem) = current_element {
        elements.push(elem);
    }

    Ok(elements)
}

/// Determine if an element type can continue across multiple lines
fn can_continue(element_type: ElementType) -> bool {
    matches!(element_type, ElementType::Action | ElementType::Dialogue)
}

/// Classify a line based on indentation and content
fn classify_line(line: &str, prev_type: Option<ElementType>) -> ElementType {
    let trimmed = line.trim();
    let indent = count_leading_spaces(line);

    // Scene heading: ALL CAPS, starts with INT./EXT./EST./I/E
    if is_scene_heading(trimmed) {
        return ElementType::Scene;
    }

    // Transition: Heavy right indent (>50 spaces) or ends with "TO:"
    // Transitions are typically ALL CAPS and heavily indented
    if indent > 50 || is_transition(trimmed) {
        return ElementType::Transition;
    }

    // Parenthetical: starts with '(' and ends with ')'
    if trimmed.starts_with('(') && trimmed.ends_with(')') {
        return ElementType::Parenthetical;
    }

    // Character: ANY indent (5+) + ALL CAPS
    // Screenplays can use different indentation schemes (some use 12 spaces, others 20+)
    // But not if previous was character (avoid false positives)
    if indent >= 5 && is_all_caps(trimmed) && !matches!(prev_type, Some(ElementType::Character)) {
        return ElementType::Character;
    }

    // Dialogue: ANY indent (3+) + previous was Character, Parenthetical, or Dialogue
    // More permissive to handle different screenplay formatting conventions
    if indent >= 3
        && matches!(
            prev_type,
            Some(ElementType::Character)
                | Some(ElementType::Parenthetical)
                | Some(ElementType::Dialogue)
        )
    {
        return ElementType::Dialogue;
    }

    // Default to Action (left-aligned, regular text)
    ElementType::Action
}

/// Count leading spaces in a line
fn count_leading_spaces(line: &str) -> usize {
    line.chars().take_while(|c| *c == ' ').count()
}

/// Check if line is a scene heading
fn is_scene_heading(trimmed: &str) -> bool {
    if !is_all_caps(trimmed) {
        return false;
    }

    // Common scene heading prefixes
    let prefixes = ["INT.", "EXT.", "INT/EXT", "I/E", "EST.", "INT ", "EXT "];

    prefixes.iter().any(|prefix| trimmed.starts_with(prefix))
}

/// Check if line is a transition
fn is_transition(trimmed: &str) -> bool {
    // Transitions often end with "TO:" or are ALL CAPS with ":"
    if trimmed.ends_with("TO:") || trimmed.ends_with(':') {
        return is_all_caps(trimmed);
    }

    // Common transitions
    let transitions = [
        "FADE OUT",
        "FADE IN",
        "CUT TO",
        "DISSOLVE TO",
        "SMASH CUT TO",
        "MATCH CUT TO",
    ];

    transitions
        .iter()
        .any(|trans| trimmed.starts_with(trans) && is_all_caps(trimmed))
}

/// Check if text is all uppercase (ignoring spaces, punctuation, and numbers)
fn is_all_caps(text: &str) -> bool {
    let letters: Vec<char> = text.chars().filter(|c| c.is_alphabetic()).collect();

    if letters.is_empty() {
        return false;
    }

    letters.iter().all(|c| c.is_uppercase())
}

/// Convert parsed elements to CSV format with columns for each element type
///
/// The CSV has 6 columns: Transition, Scene, Action, Character, Parenthetical, Dialogue
///
/// Grouping rules:
/// - Transition + Scene go on the same row (one of each)
/// - Each Action gets its own row
/// - Character + Parenthetical + Dialogue go on the same row (Character starts new dialogue group)
fn elements_to_csv(elements: &[ScreenplayElement]) -> String {
    #[derive(Debug, Clone)]
    struct CsvRow {
        transition: String,
        scene: String,
        action: String,
        character: String,
        parenthetical: String,
        dialogue: String,
    }

    impl CsvRow {
        fn new() -> Self {
            Self {
                transition: String::new(),
                scene: String::new(),
                action: String::new(),
                character: String::new(),
                parenthetical: String::new(),
                dialogue: String::new(),
            }
        }

        fn is_empty(&self) -> bool {
            self.transition.is_empty()
                && self.scene.is_empty()
                && self.action.is_empty()
                && self.character.is_empty()
                && self.parenthetical.is_empty()
                && self.dialogue.is_empty()
        }

        fn has_dialogue_group(&self) -> bool {
            !self.character.is_empty()
                || !self.parenthetical.is_empty()
                || !self.dialogue.is_empty()
        }

        fn has_scene_group(&self) -> bool {
            !self.transition.is_empty() || !self.scene.is_empty()
        }

        fn has_action(&self) -> bool {
            !self.action.is_empty()
        }

        fn to_csv_line(&self) -> String {
            // Escape and quote if needed
            let escape = |s: &str| {
                if s.contains(',') || s.contains('"') || s.contains('\n') {
                    format!("\"{}\"", s.replace('"', "\"\""))
                } else {
                    s.to_string()
                }
            };

            format!(
                "{},{},{},{},{},{}",
                escape(&self.transition),
                escape(&self.scene),
                escape(&self.action),
                escape(&self.character),
                escape(&self.parenthetical),
                escape(&self.dialogue)
            )
        }
    }

    let mut rows: Vec<CsvRow> = Vec::new();
    let mut current_row = CsvRow::new();

    for elem in elements {
        match elem.element_type {
            ElementType::Transition => {
                // Finish current row if it has action or dialogue
                if current_row.has_action() || current_row.has_dialogue_group() {
                    if !current_row.is_empty() {
                        rows.push(current_row);
                    }
                    current_row = CsvRow::new();
                }
                current_row.transition = elem.content.clone();
            }
            ElementType::Scene => {
                // Finish current row if it has action or dialogue
                if current_row.has_action() || current_row.has_dialogue_group() {
                    if !current_row.is_empty() {
                        rows.push(current_row);
                    }
                    current_row = CsvRow::new();
                }
                current_row.scene = elem.content.clone();
            }
            ElementType::Action => {
                // Finish current row
                if !current_row.is_empty() {
                    rows.push(current_row);
                }
                // Add action to new row and immediately finish it
                current_row = CsvRow::new();
                current_row.action = elem.content.clone();
                rows.push(current_row);
                current_row = CsvRow::new();
            }
            ElementType::Character => {
                // Finish current row (Character always starts new dialogue group)
                if !current_row.is_empty() {
                    rows.push(current_row);
                }
                current_row = CsvRow::new();
                current_row.character = elem.content.clone();
            }
            ElementType::Parenthetical => {
                // If current row has scene/action, finish it
                if current_row.has_scene_group() || current_row.has_action() {
                    if !current_row.is_empty() {
                        rows.push(current_row);
                    }
                    current_row = CsvRow::new();
                }
                // Add to current row (should have Character, but handle gracefully if not)
                current_row.parenthetical = elem.content.clone();
            }
            ElementType::Dialogue => {
                // If current row has scene/action, finish it
                if current_row.has_scene_group() || current_row.has_action() {
                    if !current_row.is_empty() {
                        rows.push(current_row);
                    }
                    current_row = CsvRow::new();
                }
                // Add to current row (should have Character, but handle gracefully if not)
                current_row.dialogue = elem.content.clone();
            }
        }
    }

    // Push final row if not empty
    if !current_row.is_empty() {
        rows.push(current_row);
    }

    // Build CSV
    let mut csv = String::from("Transition,Scene,Action,Character,Parenthetical,Dialogue\n");
    for row in rows {
        csv.push_str(&row.to_csv_line());
        csv.push('\n');
    }

    csv
}

/// Parse CSV content into screenplay elements
fn parse_csv_to_elements(csv_content: &str) -> Result<Vec<ScreenplayElement>, String> {
    let mut elements = Vec::new();
    let lines: Vec<&str> = csv_content.lines().collect();

    // Skip header row
    if lines.is_empty() {
        return Ok(elements);
    }

    for (index, line) in lines.iter().skip(1).enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        // Parse CSV line - handle quoted fields
        let fields = parse_csv_line(line)
            .map_err(|e| format!("CSV parsing error at line {}: {}", index + 2, e))?;

        if fields.len() != 6 {
            return Err(format!(
                "Invalid CSV format at line {}: expected 6 columns, found {}",
                index + 2,
                fields.len()
            ));
        }

        // Extract fields: Transition, Scene, Action, Character, Parenthetical, Dialogue
        let transition = fields[0].trim();
        let scene = fields[1].trim();
        let action = fields[2].trim();
        let character = fields[3].trim();
        let parenthetical = fields[4].trim();
        let dialogue = fields[5].trim();

        // Add elements in order based on what's present
        if !transition.is_empty() {
            elements.push(ScreenplayElement {
                element_type: ElementType::Transition,
                content: transition.to_string(),
            });
        }

        if !scene.is_empty() {
            elements.push(ScreenplayElement {
                element_type: ElementType::Scene,
                content: scene.to_string(),
            });
        }

        if !action.is_empty() {
            elements.push(ScreenplayElement {
                element_type: ElementType::Action,
                content: action.to_string(),
            });
        }

        if !character.is_empty() {
            elements.push(ScreenplayElement {
                element_type: ElementType::Character,
                content: character.to_string(),
            });
        }

        if !parenthetical.is_empty() {
            elements.push(ScreenplayElement {
                element_type: ElementType::Parenthetical,
                content: parenthetical.to_string(),
            });
        }

        if !dialogue.is_empty() {
            elements.push(ScreenplayElement {
                element_type: ElementType::Dialogue,
                content: dialogue.to_string(),
            });
        }
    }

    Ok(elements)
}

/// Simple CSV line parser that handles quoted fields
/// Returns an error if quotes are not properly closed
fn parse_csv_line(line: &str) -> Result<Vec<String>, String> {
    let mut fields = Vec::new();
    let mut current_field = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                // Check for escaped quote ""
                if in_quotes && chars.peek() == Some(&'"') {
                    current_field.push('"');
                    chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                fields.push(current_field.clone());
                current_field.clear();
            }
            _ => {
                current_field.push(ch);
            }
        }
    }

    // Check for unclosed quotes
    if in_quotes {
        return Err("Unclosed quote in CSV line".to_string());
    }

    // Push final field
    fields.push(current_field);

    Ok(fields)
}

/// Convert screenplay elements back to formatted screenplay text
fn elements_to_screenplay(elements: &[ScreenplayElement]) -> String {
    let mut screenplay = String::new();

    for element in elements {
        // Add blank line before scene headings and character names for readability
        // (except at the very start)
        if !screenplay.is_empty() {
            match element.element_type {
                ElementType::Scene | ElementType::Character => {
                    screenplay.push('\n');
                }
                _ => {}
            }
        }

        // Format element with appropriate indentation
        match element.element_type {
            ElementType::Scene => {
                // Scene headings: left-aligned, ALL CAPS
                screenplay.push_str(&element.content);
                screenplay.push('\n');
            }
            ElementType::Action => {
                // Action: left-aligned
                screenplay.push_str(&element.content);
                screenplay.push('\n');
            }
            ElementType::Character => {
                // Character: indented 20 spaces
                screenplay.push_str("                    ");
                screenplay.push_str(&element.content);
                screenplay.push('\n');
            }
            ElementType::Parenthetical => {
                // Parenthetical: indented 15 spaces, wrapped in parentheses if not already
                screenplay.push_str("               ");
                if !element.content.starts_with('(') {
                    screenplay.push('(');
                }
                screenplay.push_str(&element.content);
                if !element.content.ends_with(')') {
                    screenplay.push(')');
                }
                screenplay.push('\n');
            }
            ElementType::Dialogue => {
                // Dialogue: indented 10 spaces
                screenplay.push_str("          ");
                screenplay.push_str(&element.content);
                screenplay.push('\n');
            }
            ElementType::Transition => {
                // Transition: indented 44 spaces (roughly right-aligned for 8.5" page)
                screenplay.push_str("                                            ");
                screenplay.push_str(&element.content);
                screenplay.push('\n');
            }
        }
    }

    screenplay
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scene_heading_detection() {
        assert!(is_scene_heading("INT. OFFICE - DAY"));
        assert!(is_scene_heading("EXT. STREET - NIGHT"));
        assert!(is_scene_heading("INT/EXT CAR - MORNING"));
        assert!(!is_scene_heading("interior office"));
        assert!(!is_scene_heading("John enters."));
    }

    #[test]
    fn test_all_caps_detection() {
        assert!(is_all_caps("JOHN"));
        assert!(is_all_caps("MARY (V.O.)"));
        assert!(is_all_caps("DR. SMITH"));
        assert!(!is_all_caps("John"));
        assert!(!is_all_caps("Hello there"));
    }

    #[test]
    fn test_transition_detection() {
        assert!(is_transition("FADE OUT."));
        assert!(is_transition("CUT TO:"));
        assert!(is_transition("DISSOLVE TO:"));
        assert!(!is_transition("He walks to the door."));
    }

    #[test]
    fn test_simple_screenplay() {
        // Note: Indentation is significant in screenplay format
        // Character names are indented ~20 spaces, dialogue ~10 spaces
        // Using explicit string concatenation to preserve exact spacing
        let mut screenplay = String::new();
        screenplay.push_str("INT. OFFICE - DAY\n");
        screenplay.push_str("\n");
        screenplay.push_str("John enters the room.\n");
        screenplay.push_str("\n");
        screenplay.push_str("                    JOHN\n"); // 20 spaces
        screenplay.push_str("          Hello, everyone!\n"); // 10 spaces
        screenplay.push_str("\n");
        screenplay.push_str("                    MARY\n"); // 20 spaces
        screenplay.push_str("          Hi, John.\n"); // 10 spaces
        screenplay.push_str("\n");
        screenplay.push_str("                                            FADE OUT.\n"); // 44 spaces (right-aligned)

        let result = convert_screenplay_to_csv(screenplay);
        assert!(result.is_ok());

        let csv = result.unwrap();
        println!("Generated CSV:\n{}", csv);

        // Check header
        assert!(csv.starts_with("Transition,Scene,Action,Character,Parenthetical,Dialogue\n"));

        // Check scene row
        assert!(csv.contains(",INT. OFFICE - DAY,,,,"));

        // Check action row
        assert!(csv.contains(",,John enters the room.,,,"));

        // Check dialogue rows (Character + Dialogue on same row)
        assert!(csv.contains(",,,JOHN,,\"Hello, everyone!\""));
        assert!(csv.contains(",,,MARY,,\"Hi, John.\""));

        // Check transition (should be on its own row or with scene)
        assert!(csv.contains("FADE OUT."));
    }

    #[test]
    fn test_parenthetical() {
        // Note: Indentation is significant
        let mut screenplay = String::new();
        screenplay.push_str("                    JOHN\n"); // 20 spaces - Character
        screenplay.push_str("               (nervously)\n"); // 15 spaces - Parenthetical
        screenplay.push_str("          I don't know what to say.\n"); // 10 spaces - Dialogue

        let result = convert_screenplay_to_csv(screenplay);
        assert!(result.is_ok());

        let csv = result.unwrap();
        println!("Parenthetical test CSV:\n{}", csv);

        // Character, Parenthetical, and Dialogue should all be on the same row
        assert!(csv.contains(",,,JOHN,(nervously),I don't know what to say."));
    }

    #[test]
    fn test_multiline_action() {
        let screenplay = r#"John walks to the window.
He looks outside at the rain.
The streets are empty."#;

        let result = convert_screenplay_to_csv(screenplay.to_string());
        assert!(result.is_ok());

        let csv = result.unwrap();
        // Multi-line action should be combined into one row with Action column filled
        assert!(csv.contains(
            ",,John walks to the window. He looks outside at the rain. The streets are empty.,,,"
        ));
    }

    #[test]
    #[ignore] // Run with: cargo test -- --ignored
    fn test_all_about_eve_sample() {
        // This test uses the actual All About Eve screenplay sample
        // It's marked as ignored because it requires the file to exist
        use std::fs;

        let screenplay = fs::read_to_string("../resources/sample_aae_fulltext.txt")
            .expect("Failed to read All About Eve sample file");

        let result = convert_screenplay_to_csv(screenplay);
        assert!(result.is_ok());

        let csv = result.unwrap();

        // Verify header
        assert!(csv.starts_with("Transition,Scene,Action,Character,Parenthetical,Dialogue\n"));

        // Verify some key elements are detected
        assert!(csv.contains("INT. EVE'S HOTEL APARTMENT - NIGHT"));
        assert!(csv.contains(",,,EVE,")); // Character EVE
        assert!(csv.contains(",,,GIRL,")); // Character GIRL
        assert!(csv.contains(",,,ADDISON,")); // Character ADDISON
        assert!(csv.contains(",,,PHOEBE,")); // Character PHOEBE
        assert!(csv.contains("FADE OUT.")); // Transition
        assert!(csv.contains(",(pauses),")); // At least one parenthetical
    }
}
