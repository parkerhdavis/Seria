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

impl ElementType {
    /// Convert element type to string for CSV output
    pub fn as_str(&self) -> &'static str {
        match self {
            ElementType::Scene => "Scene",
            ElementType::Action => "Action",
            ElementType::Character => "Character",
            ElementType::Parenthetical => "Parenthetical",
            ElementType::Dialogue => "Dialogue",
            ElementType::Transition => "Transition",
        }
    }
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
/// # Example CSV Output
/// ```csv
/// Type,Content
/// Scene,"INT. OFFICE - DAY"
/// Action,"John enters the room."
/// Character,JOHN
/// Dialogue,"Hello, everyone!"
/// ```
#[tauri::command]
pub fn convert_screenplay_to_csv(content: String) -> Result<String, String> {
    let elements = parse_screenplay(&content)?;
    let csv = elements_to_csv(&elements);
    Ok(csv)
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
        let context_type = current_element.as_ref().map(|e| e.element_type).or(prev_type);

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
                prev_type = Some(elem_type);  // Update prev_type after pushing
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
    if indent >= 5
        && is_all_caps(trimmed)
        && !matches!(prev_type, Some(ElementType::Character))
    {
        return ElementType::Character;
    }

    // Dialogue: ANY indent (3+) + previous was Character, Parenthetical, or Dialogue
    // More permissive to handle different screenplay formatting conventions
    if indent >= 3 {
        if matches!(
            prev_type,
            Some(ElementType::Character) | Some(ElementType::Parenthetical) | Some(ElementType::Dialogue)
        ) {
            return ElementType::Dialogue;
        }
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
    let prefixes = [
        "INT.",
        "EXT.",
        "INT/EXT",
        "I/E",
        "EST.",
        "INT ",
        "EXT ",
    ];

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

/// Convert parsed elements to CSV format
fn elements_to_csv(elements: &[ScreenplayElement]) -> String {
    let mut csv = String::from("Type,Content\n");

    for elem in elements {
        // Escape quotes in content for CSV
        let escaped_content = elem.content.replace('"', "\"\"");

        // Quote content if it contains commas, quotes, or newlines
        let quoted_content = if escaped_content.contains(',')
            || escaped_content.contains('"')
            || escaped_content.contains('\n')
        {
            format!("\"{}\"", escaped_content)
        } else {
            escaped_content
        };

        csv.push_str(&format!("{},{}\n", elem.element_type.as_str(), quoted_content));
    }

    csv
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
        screenplay.push_str("                    JOHN\n");  // 20 spaces
        screenplay.push_str("          Hello, everyone!\n"); // 10 spaces
        screenplay.push_str("\n");
        screenplay.push_str("                    MARY\n");  // 20 spaces
        screenplay.push_str("          Hi, John.\n");        // 10 spaces
        screenplay.push_str("\n");
        screenplay.push_str("                                            FADE OUT.\n"); // 44 spaces (right-aligned)

        let result = convert_screenplay_to_csv(screenplay);
        assert!(result.is_ok());

        let csv = result.unwrap();
        println!("Generated CSV:\n{}", csv);
        assert!(csv.contains("Scene,INT. OFFICE - DAY"));
        assert!(csv.contains("Action,John enters the room."));
        assert!(csv.contains("Character,JOHN"));
        assert!(csv.contains("Dialogue,\"Hello, everyone!\""));  // Quotes added by CSV escaping
        assert!(csv.contains("Character,MARY"));
        assert!(csv.contains("Dialogue,\"Hi, John.\""));  // Quotes added by CSV escaping
        assert!(csv.contains("Transition,FADE OUT."));
    }

    #[test]
    fn test_parenthetical() {
        // Note: Indentation is significant
        let mut screenplay = String::new();
        screenplay.push_str("                    JOHN\n");        // 20 spaces - Character
        screenplay.push_str("               (nervously)\n");      // 15 spaces - Parenthetical
        screenplay.push_str("          I don't know what to say.\n"); // 10 spaces - Dialogue

        let result = convert_screenplay_to_csv(screenplay);
        assert!(result.is_ok());

        let csv = result.unwrap();
        println!("Parenthetical test CSV:\n{}", csv);
        assert!(csv.contains("Character,JOHN"));
        assert!(csv.contains("Parenthetical,(nervously)"));
        assert!(csv.contains("Dialogue,I don't know what to say."));
    }

    #[test]
    fn test_multiline_action() {
        let screenplay = r#"John walks to the window.
He looks outside at the rain.
The streets are empty."#;

        let result = convert_screenplay_to_csv(screenplay.to_string());
        assert!(result.is_ok());

        let csv = result.unwrap();
        // Multi-line action should be combined
        assert!(csv.contains("Action,John walks to the window. He looks outside at the rain. The streets are empty."));
    }

    #[test]
    #[ignore]  // Run with: cargo test -- --ignored
    fn test_all_about_eve_sample() {
        // This test uses the actual All About Eve screenplay sample
        // It's marked as ignored because it requires the file to exist
        use std::fs;

        let screenplay = fs::read_to_string("../resources/screenplay_sample_all_about_eve.txt")
            .expect("Failed to read All About Eve sample file");

        let result = convert_screenplay_to_csv(screenplay);
        assert!(result.is_ok());

        let csv = result.unwrap();

        // Verify some key elements are detected
        assert!(csv.contains("Scene,INT. EVE'S HOTEL APARTMENT - NIGHT"));
        assert!(csv.contains("Character,EVE"));
        assert!(csv.contains("Character,GIRL"));
        assert!(csv.contains("Character,ADDISON"));
        assert!(csv.contains("Character,PHOEBE"));
        assert!(csv.contains("Transition,FADE OUT."));
        assert!(csv.contains("Parenthetical,"));  // Should have at least one parenthetical
    }
}
