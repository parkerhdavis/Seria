// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * File Converters Module
 *
 * This module provides converters for various file formats to CSV.
 * Converters are designed to help users import content from different
 * formats (screenplay, Fountain, Excel, PDF) into Seria for editing.
 *
 * Each converter takes content or a file path and returns CSV-formatted
 * string that can be parsed by PapaParse in the frontend.
 */
pub mod screenplay;
