require('dotenv').config();
const axios = require('axios');

module.exports.sendBubbleApiRequest = async function (payload) {
  try {
    const response = await axios.post(process.env.BUBBLE_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${process.env.BUBBLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Bubble API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

module.exports.sendEmail = async function (emailData) {
  try {
    const result = await this.sendBubbleApiRequest(emailData);
    console.log('Email sent via Bubble API:', result);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

module.exports.triggerAlertMessage = async function (payload) {
  try {
    const response = await axios.post(
      process.env.BUBBLE_API_ALERT_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.BUBBLE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Bubble API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

module.exports.sendAlert = async function (emailData) {
  try {
    const result = await this.triggerAlertMessage(emailData);
    console.log('Message Alert sent via Bubble API:', result);
    return result;
  } catch (error) {
    console.error('Failed to send Message Alert:', error);
  }
};
