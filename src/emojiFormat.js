const EMOJI_METADATA_MUTATORS = {
    '⬜': ({bold, italics}) => ({color: 'white', bold, italics}),
    '⬛': ({bold, italics}) => ({color: 'gray', bold, italics}),
    '🟥': ({bold, italics}) => ({color: 'red', bold, italics}),
    '🟨': ({bold, italics}) => ({color: 'yellow', bold, italics}),
    '🟩': ({bold, italics}) => ({color: 'green', bold, italics}),
    '🟦': ({bold, italics}) => ({color: 'aqua', bold, italics}),
    '🟪': ({bold, italics}) => ({color: 'light_purple', bold, italics}),
    '➕': ({color, italics}) => ({color, bold: true, italics}),
    '➖': ({color, italics}) => ({color, bold: false, italics}),
    '✖': ({color, bold}) => ({color, bold, italics: true}),
    '➗': ({color, bold}) => ({color, bold, italics: false}),
};

/*
 * Converts text with emojis to valid chat messages. Emojis are used to modify the text format.
 *
 * The following emojis are supported:
 * - ⬜: White
 * - ⬛: Gray
 * - 🟥: Red
 * - 🟨: Yellow
 * - 🟩: Green
 * - 🟦: Aqua
 * - 🟪: Light Purple
 * - ➕: Bold
 * - ➖: End Bold
 * - ✖: Italics
 * - ➗: End Italics
 *
 * Example:
 * - Input: "🟥➕Hello🟦➖World"
 * - Output: [
 *       {color: 'red',  bold: true,  italics: false, text: 'Hello'},
 *       {color: 'aqua', bold: false, italics: false, text: 'World'},
 *   ]
 */
export function emojiFormat(message) {
    const result = [];

    let metadata = {color: 'white', bold: false, italics: false};
    let text = '';

    for (const character of message) {
        if (character in EMOJI_METADATA_MUTATORS)  {
            if (text !== '') {
                result.push({...metadata, text});
                text = '';
            }

            metadata = EMOJI_METADATA_MUTATORS[character](metadata);
        } else {
            text += character;
        }
    }

    result.push({...metadata, text});

    return result;
}
