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
  console.log('Fetching tasks...');
  let allTasks = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/task`, { headers, params: { page } });
    allTasks = allTasks.concat(data.tasks);
    if (data.tasks.length < 100) hasMore = false;
    else page++;
  }
  console.log(`  Found ${allTasks.length} tasks in ClickUp.`);
  return new Map(allTasks.map(task => [task.name.toLowerCase().trim(), task.id]));
}

async function getCustomFields() {
  console.log('Fetching custom field definitions...');
  const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/field`, { headers });
  return new Map(data.fields.map(field => [field.name, field]));
}

function getFieldValue(field, value) {
    if (!value || value === 'N/A' || value === '') return null;

    if (field.type === 'drop_down' || field.type === 'labels') {
        const options = field.type_config.options || [];
        const normalizedValue = value.toLowerCase().trim();
        
        const option = options.find(o => {
            const label = (o.name || o.label || "").toLowerCase().trim();
            return normalizedValue.includes(label) || label.includes(normalizedValue);
        });

        if (!option) return null;
        return (field.type === 'labels') ? [option.id] : option.id;
    } else if (field.type === 'number') {
        const match = value.match(/\d+/);
        return match ? Number(match[0]) : null;
    } else if (field.type === 'url' || field.type === 'short_text') {
        return value;
    }
    return null;
}

// --- MAIN EXECUTION ---

async function main() {
  if (!API_TOKEN) return console.error('ERROR: CLICKUP_API_TOKEN not set.');

  try {
    const markdownData = parseMarkdown();
    const taskMap = await getAllClickUpTasks();
    const fieldMap = await getCustomFields();

    console.log(`\n--- Migrating to Custom Fields ---`);

    for (const item of markdownData) {
      const title = item['Title'];
      const taskId = taskMap.get(title.toLowerCase().trim());

      if (!taskId) continue;

      const customFieldsPayload = [];
      const fieldsToProcess = [
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

      for (const f of fieldsToProcess) {
          const field = fieldMap.get(f.name);
          if (field) {
              const val = getFieldValue(field, item[f.key]);
              if (val !== null) {
                  customFieldsPayload.push({ id: field.id, value: val });
              }
          }
      }

      if (customFieldsPayload.length > 0) {
        try {
          await axios.put(`${API_URL}/task/${taskId}`, { custom_fields: customFieldsPayload }, { headers });
          console.log(`[SUCCESS] Updated "${title}" (${customFieldsPayload.length} fields)`);
        } catch (e) {
          console.log(`[FAILED]  "${title}": ${e.message}`);
        }
      } else {
        console.log(`[SKIPPED] "${title}" (No matching data found)`);
      }
    }
    console.log('\n--- Process Complete ---');
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
  }
}

main();
