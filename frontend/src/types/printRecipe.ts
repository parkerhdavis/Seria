/**
 * Print Recipe Types
 *
 * Print Recipes define how Cell Data should be visualized in different
 * print formats. Each recipe has "ingredients" (required/optional fields)
 * that map to Cell columns, along with rendering rules.
 */

/** Text transformation functions */
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

/** Font family options */
export type FontFamily = "Courier" | "Times New Roman" | "Arial" | "Helvetica" | "Georgia" | "Verdana";


/**
 * Recipe ingredient definition
 * Represents a field that needs to be mapped from the Cell
 */
export interface RecipeIngredient {
    setup: {
        name: string;                   // Display name (e.g., "Title", "Character Name")
        description: string;            // Description of what this field represents
        required: boolean;              // Whether this ingredient is required for the recipe
        autoMapKeywords: string[];      // Keywords to use for automatic field matching (case-insensitive)
        multipleAllowed?: boolean;      // Whether multiple Cell columns can map to this ingredient (e.g., for "Content")
    };
    style: {
        fontFamily: FontFamily;
        fontSize: number;               // Font size in points
        fontColor?: string;             // Optional text color using utility class (e.g., "text-primary", "text-base-content/60")
        fontWeight?: number;            // Font weight (100-900, e.g., 400 = normal, 700 = bold)
        italic?: boolean;
        underline?: boolean;
        textTransform?: TextTransform;  // Optional text transformation
        textAlign: string;
        leftMargin: number;             // Left margin in inches (beyond document margin)
        rightMargin?: number;           // Right margin in inches (beyond document margin)
        lineSpaceBefore: number;        // Space before element (in line heights)
        lineSpaceAfter: number;         // Space after element (in line heights)
    };
}

/**
 * Recipe-specific rendering settings
 */
export interface RecipeDocumentSettings {
    // Common settings
    pageWidth?: number;             // Page width in inches (default 8.5)
    pageHeight?: number;            // Page height in inches (default 11)
    marginTop?: number;             // Top margin in inches (default 1)
    marginBottom?: number;          // Bottom margin in inches (default 1)
    marginLeft?: number;            // Left margin in inches (default 1.5)
    marginRight?: number;           // Right margin in inches (default 1)
    backgroundColor?: string;       // Background color using utility class (e.g., "bg-black/10", "bg-base-200")

    // Corkboard-specific settings
    cardWidth?: number;             // Card width in pixels (for Corkboard Print)
    cardHeight?: number;            // Card height in pixels (for Corkboard Print)
    cardsPerRow?: number;           // Number of cards per row (for Corkboard Print)
    cardSpacing?: number;           // Spacing between cards in pixels

    // Custom settings (extensible)
    [key: string]: unknown;
}

/**
 * Print Recipe definition
 * Core structure for all print formats
 */
export interface PrintRecipe {
    id: string;                     // Unique identifier (e.g., "corkboard", "screenplay")
    name: string;                   // Display name (e.g., "Corkboard Print", "Screenplay Print")
    description: string;            // Description of what this recipe does
    type: RecipeType;               // Type of recipe
    ingredients: Record<string, RecipeIngredient>; // Ingredients keyed by ID
    documentSettings: RecipeDocumentSettings; // Recipe-specific rendering settings
    version: string;                // Recipe version (for future compatibility)
    isCustom: boolean;              // Whether this is a user-created custom recipe
    createdAt?: Date;               // When this recipe was created (for custom recipes)
    modifiedAt?: Date;              // When this recipe was last modified (for custom recipes)
}

/**
 * Recipe type enum
 */
export type RecipeType = "corkboard" | "screenplay" | "dialogue" | "graph" | "record" | "custom";



/**
 * Field mapping from Cell column to recipe ingredient
 */
export interface RecipeFieldMapping {
    ingredientId: string;           // Which ingredient this maps to
    cellColumn: string | null;       // Which Cell column to use (null if unmapped)
    isAutoMapped: boolean;          // Whether this was automatically mapped or manually set
    order?: number;                 // For ingredients that allow multiple mappings, the display order
}
/**
 * Recipe configuration (links a recipe to specific Cell field mappings)
 */
export interface RecipeConfiguration {
    recipeId: string;               // Which recipe this configuration is for
    fieldMappings: RecipeFieldMapping[]; // Field mappings for this configuration
    renderSettings: RecipeDocumentSettings; // Override render settings (optional)
    lastModified: Date;             // When this configuration was last modified
}

/**
 * Auto-mapping result
 * Contains the results of attempting to auto-map Cell columns to recipe ingredients
 */
export interface AutoMapResult {
    mappings: RecipeFieldMapping[]; // Successfully auto-mapped fields
    unmappedIngredients: string[];  // Ingredient IDs that couldn't be auto-mapped
    unmappedColumns: string[];      // Cell column names that weren't used in mapping
    confidence: number;             // Overall confidence score (0-1) for the auto-mapping
}

/**
 * Rendered element for a recipe ingredient
 * Used by recipe renderers to represent styled content
 */
export interface RenderedElement {
    ingredientId: string;           // Which ingredient this element represents
    content: string;                // The actual text content
    style: RecipeIngredient["style"]; // Applied styling
    metadata?: Record<string, unknown>; // Optional metadata (e.g., page breaks, scene numbers)
}

/**
 * Recipe renderer interface
 * All recipe renderers should implement this interface
 */
export interface RecipeRenderer {
    /**
     * Renders Cell Data according to the recipe configuration
     * @param data - Cell Data rows
     * @param headers - Cell column headers
     * @param recipe - The recipe to use
     * @param configuration - The field mapping configuration
     * @returns Array of rendered elements
     */
    render(
        data: string[][],
        headers: string[],
        recipe: PrintRecipe,
        configuration: RecipeConfiguration
    ): RenderedElement[];

    /**
     * Validates that a configuration is valid for this recipe
     * @param recipe - The recipe
     * @param configuration - The configuration to validate
     * @returns Validation result with any errors
     */
    validate(
        recipe: PrintRecipe,
        configuration: RecipeConfiguration
    ): { isValid: boolean; errors: string[] };
}
