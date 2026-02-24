/**
 * Formats a phone number or JID into a valid WhatsApp JID.
 * @param {string} input - Phone number (e.g., '88017...') or full JID (e.g., '...@g.us')
 * @returns {string} - Formatted JID
 */
function formatToJID(input) {
    if (!input) return '';

    // If it's already a JID (contains @), return as is
    if (input.includes('@')) return input;

    // Remove all non-numeric characters
    let cleaned = input.replace(/\D/g, '');

    // 1. Handle redundant Bangladeshi formatting (880 + 01...)
    // If it starts with 8800, it's likely 880 (code) + 0 (trunk) + 1...
    if (cleaned.startsWith('8800')) {
        cleaned = '880' + cleaned.substring(4);
    }
    // If it's 11 digits starting with 01, it's a local number, add 88 (full country code)
    else if (cleaned.length === 11 && cleaned.startsWith('01')) {
        cleaned = '88' + cleaned;
    }
    // If it's 10 digits starting with 1, it might be the number without leading 0, prepend 880
    else if (cleaned.length === 10 && (cleaned.startsWith('13') || cleaned.startsWith('14') || cleaned.startsWith('15') || cleaned.startsWith('16') || cleaned.startsWith('17') || cleaned.startsWith('18') || cleaned.startsWith('19'))) {
        cleaned = '880' + cleaned;
    }

    // 2. General International Fix: Remove leading 0 if number is long (trunk prefix removal)
    // Most regions (except some like Italy) drop the 0 when using the country code.
    // We already handled BD specifically above, so this is for others.
    if (cleaned.startsWith('0') && cleaned.length > 10) {
        cleaned = cleaned.substring(1);
    }

    return cleaned + '@c.us';
}

module.exports = { formatToJID };
