import FF3Cipher from 'ff3';

const cipher = new FF3Cipher('EF4359D8D580AA4F7F036D6F04FC6A94', 'D8E7920AFA330A73', 27);

/*
 * The ff3 library used here only excepts certain characters, so this map is used to convert the characters used by the
 * library (A-Z) to characters used by the cipher (0-q) and vice versa.
 */
const CIPHER_MAP = {
    ' ': '0',
    'A': '1',
    'B': '2',
    'C': '3',
    'D': '4',
    'E': '5',
    'F': '6',
    'G': '7',
    'H': '8',
    'I': '9',
    'J': 'a',
    'K': 'b',
    'L': 'c',
    'M': 'd',
    'N': 'e',
    'O': 'f',
    'P': 'g',
    'Q': 'h',
    'R': 'i',
    'S': 'j',
    'T': 'k',
    'U': 'l',
    'V': 'm',
    'W': 'n',
    'X': 'o',
    'Y': 'p',
    'Z': 'q',
}

const REVERSE_CIPHER_MAP = Object.fromEntries(Object.entries(CIPHER_MAP).map(([key, value]) => [value, key]));

function mapThroughCipher(page) {
    return Array.from(page).map(letter => CIPHER_MAP[letter]).join('');
}

function mapThroughReverseCipher(page) {
    return Array.from(page).map(letter => REVERSE_CIPHER_MAP[letter]).join('');
}

/*
 * Use format preserving encryption to mutate one page into another.
 *
 * This is a pure function and is used to create a random shuffling of pages throughout the library.
 */
export function encrypt(page) {
    return mapThroughReverseCipher(cipher.encrypt(mapThroughCipher(page)));
}

export function decrypt(page) {
    return mapThroughReverseCipher(cipher.decrypt(mapThroughCipher(page)));
}
