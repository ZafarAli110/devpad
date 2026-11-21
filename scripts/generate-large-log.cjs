/**
 * Generate a large log file for testing streaming log analysis
 * Run with: node scripts/generate-large-log.cjs
 */

const fs = require('fs');
const path = require('path');

const TARGET_SIZE_MB = 500;
const TARGET_SIZE_BYTES = TARGET_SIZE_MB * 1024 * 1024;
const OUTPUT_PATH = path.join(__dirname, '..', 'test_logs', 'large_test_500mb.log');

// Ensure test_logs directory exists
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const levels = ['INF', 'WRN', 'ERR', 'DBG'];
const levelWeights = [70, 15, 5, 10]; // Weighted distribution

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const endpoints = [
  '/api/users', '/api/orders', '/api/products', '/api/auth/login',
  '/api/auth/logout', '/api/cart', '/api/payment', '/api/inventory',
  '/api/reports', '/api/notifications', '/api/settings', '/api/dashboard'
];

const messages = {
  INF: [
    'Request completed successfully',
    'User authenticated successfully',
    'Database query executed',
    'Cache hit for request',
    'Background job completed',
    'Email sent successfully',
    'File uploaded successfully',
    'Session created for user',
    'API rate limit check passed',
    'Health check passed'
  ],
  WRN: [
    'Slow database query detected',
    'High memory usage detected',
    'Rate limit approaching threshold',
    'Deprecated API endpoint called',
    'Cache miss, fetching from database',
    'Retry attempt for external service',
    'Request timeout approaching',
    'Low disk space warning'
  ],
  ERR: [
    'Database connection failed',
    'Authentication failed',
    'Invalid request payload',
    'External service unavailable',
    'File not found',
    'Permission denied',
    'Validation error',
    'Internal server error'
  ],
  DBG: [
    'Processing request payload',
    'Validating user permissions',
    'Building database query',
    'Serializing response',
    'Checking cache',
    'Parsing request headers'
  ]
};

const sqlQueries = [
  'SELECT * FROM Users WHERE Id = @p0',
  'INSERT INTO Orders (UserId, Total) VALUES (@p0, @p1)',
  'UPDATE Products SET Stock = Stock - @p0 WHERE Id = @p1',
  'SELECT o.*, u.Name FROM Orders o JOIN Users u ON o.UserId = u.Id',
  'DELETE FROM CartItems WHERE CartId = @p0',
  'SELECT COUNT(*) FROM Notifications WHERE UserId = @p0 AND IsRead = 0'
];

function getRandomLevel() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < levels.length; i++) {
    cumulative += levelWeights[i];
    if (rand < cumulative) return levels[i];
  }
  return 'INF';
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRequestId() {
  return `req_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCorrelationId() {
  return `corr_${Math.random().toString(36).substr(2, 12)}`;
}

function formatTimestamp(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}`;
}

function generateLogEntry(timestamp, requestId, correlationId) {
  const level = getRandomLevel();
  const message = getRandomItem(messages[level]);
  
  // Build Serilog-style text log entry
  // Format: 2025-01-27 18:30:00.123 +05:00 [INF] [RequestId:xxx] [CorrelationId:yyy] Message
  let entry = `${formatTimestamp(timestamp)} +05:00 [${level}]`;
  
  // Add request context as metadata fields
  if (Math.random() > 0.2) {
    entry += ` [RequestId:${requestId}]`;
  }
  
  if (Math.random() > 0.4) {
    entry += ` [CorrelationId:${correlationId}]`;
  }
  
  // Add HTTP method for some entries
  if (Math.random() > 0.5) {
    const method = getRandomItem(httpMethods);
    const endpoint = getRandomItem(endpoints);
    entry += ` [HttpMethod:${method}] [RequestPath:${endpoint}]`;
  }
  
  // Add the message
  entry += ` ${message}`;
  
  // Add SQL for some entries
  if (Math.random() > 0.85) {
    const sql = getRandomItem(sqlQueries);
    const duration = Math.floor(Math.random() * 500) + 1;
    entry += ` | Executed SQL in ${duration}ms: ${sql}`;
    
    // Mark some as slow queries (>100ms)
    if (duration > 100) {
      entry += ' [SLOW QUERY]';
    }
  }
  
  // Add extra metadata sometimes
  if (Math.random() > 0.8) {
    const userId = Math.floor(Math.random() * 10000);
    entry += ` [UserId:${userId}]`;
  }
  
  return entry + '\n';
}

console.log(`Generating ${TARGET_SIZE_MB}MB log file...`);
console.log(`Output: ${OUTPUT_PATH}`);

const writeStream = fs.createWriteStream(OUTPUT_PATH);
let bytesWritten = 0;
let entriesWritten = 0;
let currentTime = new Date();
currentTime.setHours(currentTime.getHours() - 24); // Start 24 hours ago

const requestIds = [];
const correlationIds = [];

// Pre-generate some request/correlation IDs for realistic grouping
for (let i = 0; i < 1000; i++) {
  requestIds.push(generateRequestId());
  correlationIds.push(generateCorrelationId());
}

const startTime = Date.now();
let lastProgress = 0;

function writeChunk() {
  let ok = true;
  
  while (ok && bytesWritten < TARGET_SIZE_BYTES) {
    // Pick a request context (reuse for grouped entries)
    const requestId = getRandomItem(requestIds);
    const correlationId = getRandomItem(correlationIds);
    
    // Generate 1-5 entries for this "request"
    const entriesPerRequest = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < entriesPerRequest && bytesWritten < TARGET_SIZE_BYTES; i++) {
      const entry = generateLogEntry(currentTime, requestId, correlationId);
      ok = writeStream.write(entry);
      bytesWritten += Buffer.byteLength(entry);
      entriesWritten++;
      
      // Advance time slightly
      currentTime = new Date(currentTime.getTime() + Math.floor(Math.random() * 100));
    }
    
    // Show progress every 10%
    const progress = Math.floor((bytesWritten / TARGET_SIZE_BYTES) * 100);
    if (progress >= lastProgress + 10) {
      lastProgress = progress;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ${progress}% - ${(bytesWritten / 1024 / 1024).toFixed(1)}MB written (${elapsed}s)`);
    }
  }
  
  if (bytesWritten < TARGET_SIZE_BYTES) {
    // Wait for drain event before continuing
    writeStream.once('drain', writeChunk);
  } else {
    // Done
    writeStream.end(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n✓ Generation complete!');
      console.log(`  File size: ${(bytesWritten / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Entries: ${entriesWritten.toLocaleString()}`);
      console.log(`  Time: ${elapsed}s`);
      console.log(`  Path: ${OUTPUT_PATH}`);
    });
  }
}

writeChunk();
