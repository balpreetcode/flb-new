/**
 * Text Generation Module
 * Uses OpenAI API for text-to-text generation
 */

const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Generate text using OpenAI
 * @param {string} prompt - User prompt
 * @param {string} systemPrompt - System prompt for context
 * @param {string} model - OpenAI model to use
 * @returns {Promise<string>} Generated text
 */
async function generateText(prompt, systemPrompt = '', model = 'gpt-4o-mini') {
    const messages = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(
        OPENAI_API_URL,
        {
            model,
            messages,
            temperature: 0.7
        },
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices[0].message.content;
}

/**
 * Parse JSON from text with fallback
 * @param {string} text - Text that may contain JSON
 * @param {Function} fallbackGenerator - Fallback function if parsing fails
 * @returns {any} Parsed JSON or fallback result
 */
function parseJSON(text, fallbackGenerator = null) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
        return JSON.parse(jsonText);
    } catch (e) {
        // Try to find array or object patterns
        const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);

        if (arrayMatch) {
            try {
                return JSON.parse(arrayMatch[0]);
            } catch (e2) { }
        }

        if (objectMatch) {
            try {
                return JSON.parse(objectMatch[0]);
            } catch (e2) { }
        }

        console.error('Failed to parse JSON:', e.message);
        if (fallbackGenerator) {
            return fallbackGenerator(text);
        }
        throw new Error('Failed to parse JSON response');
    }
}

module.exports = {
    generateText,
    parseJSON
};
