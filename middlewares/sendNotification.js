require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Fungsi reusable untuk mengirim notifikasi
 * @param {Object} options
 * @param {string[]} options.segments - Segment pengguna (default: ['Active Users'])
 * @param {string} options.title - Judul notifikasi
 * @param {string} options.message - Isi notifikasi
 * @param {Object} [options.data] - Optional data payload (misal untuk deep linking, dsb)
 */
const   sendNotification = async ({
  segments = ['Active Subscriptions'],
  title = 'No Title',
  message = 'No Message',
  data = {},
}) => {
  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: ONESIGNAL_APP_ID,
        included_segments: segments,
        headings: { en: title },
        contents: { en: message },
        data,
      },
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Notifikasi berhasil dikirim:', response.data);
    return response.data;
  } catch (error) {
    console.error(
      '❌ Gagal mengirim notifikasi:',
      error.response?.data || error.message
    );
    throw error;
  }
};

module.exports = sendNotification;
