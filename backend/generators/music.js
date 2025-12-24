/**
 * Music Generation Module
 * Uses Fal AI for text-to-music generation
 */

const axios = require('axios');

const FAL_API_KEY = process.env.FAL_KEY;

/**
 * Post to Fal AI API
 * @param {string} model - Model identifier
 * @param {object} body - Request body
 * @returns {Promise<object>} API response
 */
async function postToFal(model, body) {
    const response = await axios.post(
        `https://fal.run/${model}`,
        body,
        {
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );
    return response.data;
}

/**
 * Generate music from text prompt
 * @param {string} prompt - Music description (genre, mood, instruments)
 * @param {number} duration - Duration in seconds
 * @param {string} model - Music generation model to use
 * @returns {Promise<string>} Generated audio URL
 */
async function generateMusic(prompt, duration = 30, model = 'fal-ai/stable-audio') {
    const result = await postToFal(model, {
        prompt,
        duration: duration
    });

    // Handle different response formats
    if (result.audio_file && result.audio_file.url) {
        return result.audio_file.url;
    }
    if (result.audio && result.audio.url) {
        return result.audio.url;
    }
    if (result.audio_url) {
        return result.audio_url;
    }

    throw new Error('No music generated');
}

module.exports = {
    generateMusic
};
