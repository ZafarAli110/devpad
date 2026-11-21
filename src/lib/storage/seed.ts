import { db } from './db';
import { saveToOPFS } from './opfs';

const SAMPLE_MARKDOWN = `# Heading 1
## Heading 2
## Heading 3

This is a paragraph with **bold text**, *italic text*, and \`inline code\`.

- Item 1
- Item 2
  - Sub-item (with 2 spaces)

1. First item
2. Second item

> This is a blockquote.

[Google](https://www.google.com)

---

\`\`\`javascript
console.log("Hello World");
\`\`\`

# Markdown Master Showcase :rocket:

> This is a blockquote that now renders correctly! :star:

### Project Stats
| Feature | Status | Priority |
| :--- | :---: | ---: |
| Live Preview | ✅ | High |
| Custom Styles | ✅ | Med |
| Tables | ✅ | Low |

### Code Example
\`\`\`javascript
const app = "Smart Notepad";
console.log(\`Welcome to \${app}! :fire:\`);
\`\`\``;

const SAMPLE_QUICK_LOGS = `2024-03-28 10:00:01.123 +05:00 [INF] Starting application bootstrap...
2024-03-28 10:00:01.125 +05:00 [INF] [RequestId:REQ-001] Service 'AccountService' initialized.
2024-03-28 10:00:01.128 +05:00 [WRN] [RequestId:REQ-001] Memory usage above 80% threshold.
2024-03-28 10:00:02.000 +05:00 [ERR] [RequestId:REQ-002] Failed to connect to Redis cache. Redis timeout.
[
  {"Timestamp":"2024-03-28T10:00:03.123Z","Level":"Error","MessageTemplate":"Database query failed: {ErrorMsg}","Properties":{"ErrorMsg":"Connection reset by peer","RequestId":"REQ-003"}},
  {"Timestamp":"2024-03-28T10:00:03.500Z","Level":"Information","MessageTemplate":"Backup service heartbeat","Properties":{"Service":"AWS-S3-Backup"}}
]`;

export const SAMPLE_ANALYSIS_JSON = {
  "__type": "devpad_log_analysis_v1",
  "title": "Sample API Analysis",
  "exportedAt": new Date().toISOString(),
  "files": [
    {
      "name": "AcmeExternalAPI_20240326.txt",
      "content": "2024-03-26 14:50:02.923 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Request Path: /v1/Orders/Status\r\n2024-03-26 14:50:02.927 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Request Headers: Accept:application/json; Authorization:Bearer [REDACTED_TOKEN]; Host:api.example.com\r\n2024-03-26 14:50:02.932 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Request Query: orderId=90421\r\n2024-03-26 14:50:02.933 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Request Body: <Empty>\r\n2024-03-26 14:50:02.934 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Response HTTP Status: 403 - Forbidden\r\n2024-03-26 14:50:02.934 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Response Headers: X-Correlation-Id:43360cc867ca43e99820db52b3091daf\r\n2024-03-26 14:50:02.937 +00:00 [RequestId:REQ-1001] [CorrelationId:43360cc867ca43e99820db52b3091daf] [TenantId:104] [ERR] Response Body: {\"error\":\"missing_scope\"}\r\n"
    },
    {
      "name": "AcmeExternalAPI_20240327.txt",
      "content": "2024-03-27 14:37:21.579 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Request Path: /v1/Billing/Invoice\r\n2024-03-27 14:37:21.583 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Request Headers: Accept:application/json; Authorization:Bearer [REDACTED_TOKEN]; Host:api.example.com\r\n2024-03-27 14:37:21.586 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Request Query: invoiceId=INV-2024-882\r\n2024-03-27 14:37:21.587 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Request Body: <Empty>\r\n2024-03-27 14:37:21.587 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Response HTTP Status: 400 - Bad Request\r\n2024-03-27 14:37:21.587 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Response Headers: Content-Type:application/json; charset=utf-8; X-Correlation-Id:8c262338189e4b46868cc8b0d5b836ef\r\n2024-03-27 14:37:21.591 +00:00 [RequestId:REQ-1002] [CorrelationId:8c262338189e4b46868cc8b0d5b836ef] [TenantId:104] [ERR] Response Body: {\"error\":\"invalid_invoice_id\"}\r\n"
    }
  ]
};

const SAMPLE_DIAGRAM_CONTENT = JSON.stringify({
  nodes: [
    {
      id: '1',
      type: 'shape',
      position: { x: 250, y: 5 },
      data: { label: 'Web UI', type: 'circle' }
    },
    {
      id: '2',
      type: 'shape',
      position: { x: 250, y: 150 },
      data: { label: 'API Gateway', type: 'diamond' }
    },
    {
      id: '3',
      type: 'table',
      position: { x: 100, y: 300 },
      data: { 
        title: 'Users', 
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'username', type: 'varchar' }
        ] 
      }
    },
    {
      id: '4',
      type: 'table',
      position: { x: 400, y: 300 },
      data: { 
        title: 'Posts', 
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'userId', type: 'uuid' },
          { name: 'content', type: 'text' }
        ] 
      }
    }
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2', type: 'deletable' },
    { id: 'e2-3', source: '2', target: '3', type: 'deletable' },
    { id: 'e2-4', source: '2', target: '4', type: 'deletable' },
    { id: 'e3-4', source: '3', target: '4', label: '1:N', type: 'deletable' }
  ]
});

export async function seedDatabase() {
  const counts = {
    notes: await db.notes.count(),
    logs: await db.logs.count(),
    analyses: await db.analyses.count(),
    diagrams: await db.diagrams.count()
  };

  const isEmpty = Object.values(counts).every(c => c === 0);
  if (!isEmpty) return false;

  console.log("Seeding initial sample data...");

  // 1. Seed Notes
  const now = Date.now();
  await db.notes.bulkAdd([
    {
      id: 'seed-markdown-showcase',
      title: 'Markdown Master Showcase 🚀',
      content: SAMPLE_MARKDOWN,
      tags: ['guide', 'sample'],
      createdAt: now,
      updatedAt: now,
      language: 'markdown'
    },
    {
      id: 'seed-privacy-note',
      title: 'Confidential Meeting Notes (Hidden) 🔒',
      content: 'This note is marked as hidden. It won\'t show in the sidebar unless you toggle "Show Hidden". Useful for screen sharing during meetings!',
      tags: ['privacy', 'demo'],
      createdAt: now - 1000,
      updatedAt: now - 1000,
      isHidden: true
    }
  ]);

  // 2. Seed Quick Logs
  await db.logs.add({
    id: 'seed-quick-logs',
    title: 'Sample Error Logs',
    content: SAMPLE_QUICK_LOGS,
    tags: ['samples'],
    createdAt: now,
    updatedAt: now
  });

  // 3. Seed Diagrams
  await db.diagrams.add({
    id: 'seed-architecture',
    title: 'Example System Architecture',
    content: SAMPLE_DIAGRAM_CONTENT,
    createdAt: now,
    updatedAt: now
  });

  // 4. Seed Log Analysis
  const sessionId = 'seed-analysis-session';
  const fileMetadata = [];
  for (const file of SAMPLE_ANALYSIS_JSON.files) {
      const opfsPath = `analysis_${sessionId}_${file.name}`;
      try {
          await saveToOPFS(opfsPath, file.content);
          fileMetadata.push({
              name: file.name,
              opfsPath,
              size: file.content.length
          });
      } catch (e) {
          console.error("Failed to seed OPFS file", file.name, e);
      }
  }

  if (fileMetadata.length > 0) {
      await db.analyses.add({
          id: sessionId,
          title: SAMPLE_ANALYSIS_JSON.title,
          fileMetadata,
          stats: {
              total: 12,
              errors: 8,
              warnings: 0,
              infos: 4
          },
          createdAt: now,
          updatedAt: now
      });
  }

  return true;
}
