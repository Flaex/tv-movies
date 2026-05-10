const axios = require('axios');
const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LIST_ID = '901713629953';
const API_URL = 'https://api.clickup.com/api/v2';

async function listFields() {
  const headers = { 'Authorization': API_TOKEN };
  try {
    const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/field`, { headers });
    console.log(JSON.stringify(data.fields, null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
listFields();
