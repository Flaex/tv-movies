const fs = require('fs');
const axios = require('axios');

// --- CONFIGURATION ---
const API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LIST_ID = '901713629953';
const MARKDOWN_FILE = 'media-tracker.md';
const API_URL = 'https://api.clickup.com/api/v2';

const headers = {
  'Authorization': API_TOKEN,
  'Content-Type': 'application/json',
};

// --- HELPER FUNCTIONS ---

function parseMarkdown() {
  const content = fs.readFileSync(MARKDOWN_FILE, 'utf-8');
  const lines = content.trim().split(String.fromCharCode(10));
  const header = lines[0].trim().split('|').map(h => h.trim()).filter(Boolean);
  const data = [];

  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].trim().split('|').map(c => c.trim()).filter((_, idx) => idx > 0 && idx <= header.length);
    const row = {};
    header.forEach((col, index) => {
      row[col] = cells[index];
    });
    data.push(row);
  }
  return data;
}

async function getAllClickUpTasks() {
  let allTasks = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/task`, { headers, params: { page } });
    allTasks = allTasks.concat(data.tasks);
    if (data.tasks.length < 100) hasMore = false;
    else page++;
  }
  return new Map(allTasks.map(task => [task.name, task.id]));
}

async function getCustomFields() {
  const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/field`, { headers });
  return new Map(data.fields.map(field => [field.name, field]));
}

/**
 * Updates a single custom field for a task using the dedicated field endpoint.
 */
async function setFieldValue(taskId, field, value) {
    if (!value || value === 'N/A' || value === '') return;

    let payload = { value: value };

    // Special handling for specific field types
    if (field.type === 'drop_down') {
        const option = field.type_config.options.find(o => o.name.toLowerCase() === value.toLowerCase());
        if (!option) return console.warn(`      [SKIP] Option "${value}" not found for dropdown "${field.name}"`);
        payload.value = option.id;
    } else if (field.type === 'labels') {
        // Labels usually expect an array of strings (the label names)
        payload.value = [value];
    } else if (field.type === 'number') {
        const num = Number(value.split('–')[0].split('-')[0].replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return;
        payload.value = num;
    }

    try {
        await axios.post(`${API_URL}/field/${field.id}/task/${taskId}`, payload, { headers });
        return true;
    } catch (e) {
        console.error(`      [FAIL] Field "${field.name}":`, e.response ? JSON.stringify(e.response.data) : e.message);
        return false;
    }
}

// --- MAIN EXECUTION ---

async function main() {
  if (!API_TOKEN) return console.error('ERROR: CLICKUP_API_TOKEN not set.');

  try {
    const markdownData = parseMarkdown();
    const taskMap = await getAllClickUpTasks();
    const fieldMap = await getCustomFields();

    console.log(`\n--- Processing ${markdownData.length} items ---`);

    for (const item of markdownData) {
      const title = item['Title'];
      const taskId = taskMap.get(title);

      if (!taskId) {
        console.warn(`[MISSING] Task "${title}" not found in ClickUp.`);
        continue;
      }

      console.log(`[UPDATING] "${title}"...`);

      const fieldsToUpdate = [
          { name: 'Type', key: 'Type' },
          { name: 'Status', key: 'Status' },
          { name: 'Genre', key: 'Genre' },
          { name: 'Year', key: 'Year' },
          { name: 'Rating', key: 'Rating' },
          { name: 'Streaming Platform', key: 'Streaming Platform' },
          { name: 'Seasons', key: 'Seasons' },
          { name: 'Episodes', key: 'Episodes' },
          { name: 'Review link', key: 'Review link' }
      ];

      for (const f of fieldsToUpdate) {
          const field = fieldMap.get(f.name);
          if (field) {
              await setFieldValue(taskId, field, item[f.key]);
          }
      }
    }
    console.log('\n--- Process Complete ---');
  } catch (error) {
    console.error('CRITICAL ERROR:', error.response ? error.response.data : error.message);
  }
}

main();
