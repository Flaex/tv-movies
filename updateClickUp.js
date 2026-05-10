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
  // Use String.fromCharCode(10) to avoid escaping issues with \n
  const lines = content.trim().split(String.fromCharCode(10));
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
 * Fetches ALL tasks from the specified ClickUp list (handles pagination).
 */
async function getAllClickUpTasks() {
  console.log('Fetching tasks from ClickUp list...');
  let allTasks = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await axios.get(`${API_URL}/list/${LIST_ID}/task`, {
      headers,
      params: { page: page }
    });
    
    allTasks = allTasks.concat(data.tasks);
    console.log(`  Fetched page ${page}, total tasks so far: ${allTasks.length}`);
    
    if (data.tasks.length < 100 && data.last_page) { // Simplified check, or use 'last_page' if provided
        hasMore = false;
    } else if (data.tasks.length === 0) {
        hasMore = false;
    } else {
        page++;
    }
    
    // Safety break for extremely large lists in this context
    if (page > 10) hasMore = false; 
  }

  const taskMap = new Map(allTasks.map(task => [task.name, task.id]));
  console.log(`Total tasks found in ClickUp: ${taskMap.size}`);
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
        'Year': Number(item['Year'].split('–')[0].split('-')[0]) || null, 
        'Rating': item['Rating'],
        'Streaming Platform': item['Streaming Platform'],
        'Seasons': Number(item['Seasons']) || null,
        'Episodes': Number(item['Episodes']) || null,
        'Review link': item['Review link'],
    };

    for (const [fieldName, fieldValue] of Object.entries(mapping)) {
        if (customFieldsMap.has(fieldName) && fieldValue && fieldValue !== 'N/A' && fieldValue !== '') {
            const field = customFieldsMap.get(fieldName);
            
            if (field.type === 'drop_down') {
                 const option = field.type_config.options.find(o => o.name.toLowerCase() === fieldValue.toLowerCase());
                 if (option) {
                    payload.push({ id: field.id, value: option.id });
                 } else {
                    console.warn(`  [WARN] Could not find dropdown option for "${fieldValue}" in field "${fieldName}"`);
                 }
            } else if (field.type === 'labels') {
                // For labels, we need to handle it as an array of IDs if multiple, but here we likely have one.
                // We'll try setting the value directly if it's a simple label field.
                payload.push({ id: field.id, value: [fieldValue] });
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
    return;
  }

  try {
    const markdownData = parseMarkdown();
    const clickUpTasks = await getAllClickUpTasks();
    const customFields = await getCustomFields();

    console.log(String.fromCharCode(10) + '--- Starting to Update ClickUp Tasks ---');

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
            console.error(`  [ERROR] Failed to update task "${taskTitle}":`, e.response ? JSON.stringify(e.response.data) : e.message);
          }
        } else {
          console.log(`  [SKIP] No custom field data to update for "${taskTitle}"`);
        }
      } else {
        console.warn(`  [WARN] Task not found in ClickUp for title: "${taskTitle}"`);
      }
    }

    console.log(String.fromCharCode(10) + '--- Update Process Complete ---');

  } catch (error) {
    console.error('An unexpected error occurred:');
    console.error(error.response ? error.response.data : error.message);
  }
}

main();
