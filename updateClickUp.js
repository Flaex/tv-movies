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

/**
 * Parses the media-tracker.md file into a list of objects.
 */
function parseMarkdown() {
  console.log(`Reading and parsing ${MARKDOWN_FILE}...`);
  const content = fs.readFileSync(MARKDOWN_FILE, 'utf-8');
  const lines = content.trim().split('
');
  const header = lines[0].trim().split('|').map(h => h.trim());
  const data = [];

  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].trim().split('|').map(c => c.trim());
    const row = {};
    header.forEach((col, index) => {
      if (col) { // Ensure not to process empty columns from trailing pipes
        row[col] = cells[index];
      }
    });
    data.push(row);
  }
  console.log(`Found ${data.length} items in the markdown file.`);
  return data;
}

/**
 * Fetches all tasks from the specified ClickUp list.
 */
async function getClickUpTasks() {
  console.log('Fetching tasks from ClickUp list...');
  const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/task`, { headers });
  const taskMap = new Map(data.tasks.map(task => [task.name, task.id]));
  console.log(`Found ${taskMap.size} tasks in the ClickUp list.`);
  return taskMap;
}

/**
 * Fetches the custom fields for the list.
 */
async function getCustomFields() {
  console.log('Fetching custom fields from ClickUp list...');
  const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/field`, { headers });
  const fieldMap = new Map(data.fields.map(field => [field.name, field]));
  console.log(`Found ${fieldMap.size} custom fields.`);
  return fieldMap;
}

/**
 * Maps a markdown row to a ClickUp custom fields update payload.
 */
function mapDataToCustomFields(item, customFieldsMap) {
    const payload = [];
    const mapping = {
        'Type': item['Type'],
        'Genre': item['Genre'],
        'Year': Number(item['Year'].split('–')[0]) || null, // Take the first year for ranges
        'Rating': item['Rating'],
        'Streaming Platform': item['Streaming Platform'],
        'Seasons': Number(item['Seasons']) || null,
        'Episodes': Number(item['Episodes']) || null,
        'Review link': item['Review link'],
    };

    for (const [fieldName, fieldValue] of Object.entries(mapping)) {
        if (customFieldsMap.has(fieldName) && fieldValue && fieldValue !== 'N/A') {
            const field = customFieldsMap.get(fieldName);
            
            if (field.type === 'drop_down') {
                 const option = field.type_config.options.find(o => o.name.toLowerCase() === fieldValue.toLowerCase());
                 if (option) {
                    payload.push({ id: field.id, value: option.id });
                 } else {
                    console.warn(`  [WARN] Could not find dropdown option for "${fieldValue}" in field "${fieldName}"`);
                 }
            } else {
                 payload.push({ id: field.id, value: fieldValue });
            }
        }
    }
    return payload;
}


// --- MAIN EXECUTION ---

async function main() {
  if (!API_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN environment variable is not set.');
    console.error('Please set it before running the script:');
    console.error('export CLICKUP_API_TOKEN="your_token_here"');
    return;
  }

  try {
    const markdownData = parseMarkdown();
    const clickUpTasks = await getClickUpTasks();
    const customFields = await getCustomFields();

    console.log('
--- Starting to Update ClickUp Tasks ---');

    for (const item of markdownData) {
      const taskTitle = item['Title'];
      if (clickUpTasks.has(taskTitle)) {
        const taskId = clickUpTasks.get(taskTitle);
        const customFieldsPayload = mapDataToCustomFields(item, customFields);

        if (customFieldsPayload.length > 0) {
          try {
            await axios.put(`${API_URL}/task/${taskId}`, { custom_fields: customFieldsPayload }, { headers });
            console.log(`  [SUCCESS] Updated task: "${taskTitle}"`);
          } catch (e) {
            console.error(`  [ERROR] Failed to update task "${taskTitle}":`, e.response ? e.response.data : e.message);
          }
        } else {
          console.log(`  [SKIP] No custom field data to update for "${taskTitle}"`);
        }
      } else {
        console.warn(`  [WARN] Task not found in ClickUp for title: "${taskTitle}"`);
      }
    }

    console.log('
--- Update Process Complete ---');

  } catch (error) {
    console.error('An unexpected error occurred:');
    console.error(error.response ? error.response.data : error.message);
  }
}

main();
