const APP_CONFIG = {
  spreadsheetId: 'PUT_YOUR_SPREADSHEET_ID_HERE',
  admin: {
    username: 'sonu',
    password: 'sonu1234',
  },
  sessionExpiryDays: 7,
};

const SHEET_SCHEMAS = {
  users: [
    'userId',
    'username',
    'password',
    'active',
    'createdAt',
    'lastLoginAt',
    'createdBy',
  ],
  projects: [
    'projectId',
    'title',
    'description',
    'deadline',
    'assigneeUserId',
    'assigneeUsername',
    'createdByUserId',
    'createdByUsername',
    'createdAt',
    'statusLatest',
  ],
  project_updates: [
    'updateId',
    'projectId',
    'assigneeUserId',
    'assigneeUsername',
    'remark',
    'createdAt',
  ],
  sessions: ['token', 'userId', 'username', 'role', 'createdAt', 'expiresAt'],
};

function doGet(e) {
  return handleWebRequest_(e);
}

function doPost(e) {
  return handleWebRequest_(e);
}

function handleWebRequest_(e) {
  try {
    initializeSchema_();

    const request = parseRequest_(e);
    const route = request.route;
    const payload = request.payload;

    if (!route) {
      return createResponse_({ ok: false, message: 'Missing route parameter.' }, request.callback);
    }

    let result;

    switch (route) {
      case 'login':
        result = routeLogin_(payload);
        break;
      case 'createUser':
        result = routeCreateUser_(payload);
        break;
      case 'listUsers':
        result = routeListUsers_(payload);
        break;
      case 'createProject':
        result = routeCreateProject_(payload);
        break;
      case 'getMyProjects':
        result = routeGetMyProjects_(payload);
        break;
      case 'getAllProjects':
        result = routeGetAllProjects_(payload);
        break;
      case 'addProjectUpdate':
        result = routeAddProjectUpdate_(payload);
        break;
      case 'getProjectUpdates':
        result = routeGetProjectUpdates_(payload);
        break;
      default:
        result = { ok: false, message: 'Invalid route.' };
        break;
    }

    return createResponse_(result, request.callback);
  } catch (error) {
    return createResponse_({
      ok: false,
      message: error && error.message ? error.message : 'Unexpected server error.',
    });
  }
}

function routeLogin_(payload) {
  const username = sanitizeString_(payload.username);
  const password = sanitizeString_(payload.password);

  if (!username || !password) {
    return { ok: false, message: 'Username and password are required.' };
  }

  if (
    username === APP_CONFIG.admin.username &&
    password === APP_CONFIG.admin.password
  ) {
    const session = createSession_({
      userId: 'ADMIN',
      username: APP_CONFIG.admin.username,
      role: 'ADMIN',
    });

    return {
      ok: true,
      role: 'ADMIN',
      userId: 'ADMIN',
      username: APP_CONFIG.admin.username,
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  const users = readRows_('users');
  const user = users.find(function (row) {
    return row.username === username;
  });

  if (!user) {
    return { ok: false, message: 'Invalid username or password.' };
  }

  if (!parseBoolean_(user.active)) {
    return { ok: false, message: 'User is inactive. Contact admin.' };
  }

  // Password is stored in plain text for now. Hashing can be introduced later.
  if (String(user.password || '') !== password) {
    return { ok: false, message: 'Invalid username or password.' };
  }

  setCellByColumn_('users', user._rowNumber, 'lastLoginAt', new Date());

  const session = createSession_({
    userId: String(user.userId),
    username: String(user.username),
    role: 'USER',
  });

  return {
    ok: true,
    role: 'USER',
    userId: String(user.userId),
    username: String(user.username),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function routeCreateUser_(payload) {
  const adminSession = requireSession_(payload.adminToken || payload.token, 'ADMIN');
  const username = sanitizeString_(payload.username);
  const password = sanitizeString_(payload.password);
  const active = parseBoolean_(payload.active);

  if (!username || !password) {
    return { ok: false, message: 'Username and password are required.' };
  }

  const users = readRows_('users');
  const exists = users.some(function (row) {
    return String(row.username || '').toLowerCase() === username.toLowerCase();
  });

  if (exists) {
    return { ok: false, message: 'Username already exists.' };
  }

  const userId = generateNextId_('users', 'userId', 'U', 4);
  const now = new Date();
  const newUser = {
    userId: userId,
    username: username,
    // Password is stored in plain text for now. Hashing can be introduced later.
    password: password,
    active: active,
    createdAt: now,
    lastLoginAt: '',
    createdBy: adminSession.username,
  };

  appendRow_('users', newUser);

  return {
    ok: true,
    user: {
      userId: userId,
      username: username,
      active: active,
      createdAt: now.toISOString(),
      lastLoginAt: '',
      createdBy: adminSession.username,
    },
  };
}

function routeListUsers_(payload) {
  requireSession_(payload.token || payload.adminToken, 'ADMIN');

  const users = readRows_('users')
    .map(function (row) {
      return {
        userId: String(row.userId || ''),
        username: String(row.username || ''),
        active: parseBoolean_(row.active),
        createdAt: toIsoString_(row.createdAt),
        lastLoginAt: toIsoString_(row.lastLoginAt),
        createdBy: String(row.createdBy || ''),
      };
    })
    .sort(function (a, b) {
      return toTimestamp_(b.createdAt) - toTimestamp_(a.createdAt);
    });

  return { ok: true, users: users };
}

function routeCreateProject_(payload) {
  const session = requireSession_(payload.token);
  const title = sanitizeString_(payload.title);
  const description = sanitizeString_(payload.description);
  const deadline = sanitizeString_(payload.deadline);

  if (!title || !description) {
    return { ok: false, message: 'Title and description are required.' };
  }

  let assigneeUserId = '';
  let assigneeUsername = '';

  if (session.role === 'ADMIN') {
    assigneeUserId = sanitizeString_(payload.assigneeUserId);
    if (!assigneeUserId) {
      return { ok: false, message: 'Assignee user is required for admin-created projects.' };
    }

    const assignee = findUserById_(assigneeUserId);
    if (!assignee) {
      return { ok: false, message: 'Assignee user not found.' };
    }

    if (!parseBoolean_(assignee.active)) {
      return { ok: false, message: 'Assignee user is inactive.' };
    }

    assigneeUsername = String(assignee.username);
  } else {
    assigneeUserId = session.userId;
    assigneeUsername = session.username;
  }

  const projectId = generateNextId_('projects', 'projectId', 'P', 4);
  const now = new Date();
  const project = {
    projectId: projectId,
    title: title,
    description: description,
    deadline: deadline ? normalizeDate_(deadline) : '',
    assigneeUserId: assigneeUserId,
    assigneeUsername: assigneeUsername,
    createdByUserId: session.userId,
    createdByUsername: session.username,
    createdAt: now,
    statusLatest: '',
  };

  appendRow_('projects', project);

  return {
    ok: true,
    project: {
      projectId: projectId,
      title: title,
      description: description,
      deadline: deadline ? normalizeDate_(deadline) : '',
      assigneeUserId: assigneeUserId,
      assigneeUsername: assigneeUsername,
      createdByUserId: session.userId,
      createdByUsername: session.username,
      createdAt: now.toISOString(),
      statusLatest: '',
    },
  };
}

function routeGetMyProjects_(payload) {
  const session = requireSession_(payload.token);
  const projects = readRows_('projects')
    .filter(function (project) {
      if (session.role === 'ADMIN') {
        return true;
      }
      return String(project.assigneeUserId) === String(session.userId);
    })
    .map(projectResponse_)
    .sort(function (a, b) {
      return toTimestamp_(b.createdAt) - toTimestamp_(a.createdAt);
    });

  return { ok: true, projects: projects };
}

function routeGetAllProjects_(payload) {
  requireSession_(payload.token, 'ADMIN');

  const projects = readRows_('projects')
    .map(projectResponse_)
    .sort(function (a, b) {
      return toTimestamp_(b.createdAt) - toTimestamp_(a.createdAt);
    });

  return { ok: true, projects: projects };
}

function routeAddProjectUpdate_(payload) {
  const session = requireSession_(payload.token);
  const projectId = sanitizeString_(payload.projectId);
  const remark = sanitizeString_(payload.remark);

  if (!projectId || !remark) {
    return { ok: false, message: 'projectId and remark are required.' };
  }

  const project = findProjectById_(projectId);
  if (!project) {
    return { ok: false, message: 'Project not found.' };
  }

  if (session.role === 'USER' && String(project.assigneeUserId) !== String(session.userId)) {
    return { ok: false, message: 'Unauthorized for this project.' };
  }

  const updateId = generateNextId_('project_updates', 'updateId', 'UP', 4);
  const now = new Date();
  appendRow_('project_updates', {
    updateId: updateId,
    projectId: projectId,
    assigneeUserId: session.userId,
    assigneeUsername: session.username,
    remark: remark,
    createdAt: now,
  });

  setCellByColumn_('projects', project._rowNumber, 'statusLatest', remark);

  const updates = getUpdatesForProject_(projectId);
  return { ok: true, updates: updates };
}

function routeGetProjectUpdates_(payload) {
  const session = requireSession_(payload.token);
  const projectId = sanitizeString_(payload.projectId);

  if (!projectId) {
    return { ok: false, message: 'projectId is required.' };
  }

  const project = findProjectById_(projectId);
  if (!project) {
    return { ok: false, message: 'Project not found.' };
  }

  if (session.role === 'USER' && String(project.assigneeUserId) !== String(session.userId)) {
    return { ok: false, message: 'Unauthorized for this project.' };
  }

  return {
    ok: true,
    updates: getUpdatesForProject_(projectId),
  };
}

function parseRequest_(e) {
  const parameters = (e && e.parameter) || {};
  const body = parseBody_(e);

  const route = parameters.route || body.route || '';
  const callback = parameters.callback || body.callback || '';

  const payloadFromParam = safeParseJson_(parameters.payload);
  const payloadFromBodyPayload = safeParseJson_(body.payload);

  const payload = {};

  mergeObject_(payload, stripReservedKeys_(parameters));
  mergeObject_(payload, stripReservedKeys_(body));
  mergeObject_(payload, payloadFromParam);
  mergeObject_(payload, payloadFromBodyPayload);

  return {
    route: route,
    callback: callback,
    payload: payload,
  };
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = String(e.postData.contents || '');
  if (!raw) {
    return {};
  }

  const parsed = safeParseJson_(raw);
  if (parsed && typeof parsed === 'object') {
    return parsed;
  }

  return {};
}

function safeParseJson_(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}

function stripReservedKeys_(obj) {
  const copy = {};
  if (!obj || typeof obj !== 'object') {
    return copy;
  }

  Object.keys(obj).forEach(function (key) {
    if (key !== 'route' && key !== 'payload' && key !== 'callback') {
      copy[key] = obj[key];
    }
  });

  return copy;
}

function mergeObject_(target, source) {
  if (!source || typeof source !== 'object') {
    return;
  }

  Object.keys(source).forEach(function (key) {
    target[key] = source[key];
  });
}

function initializeSchema_() {
  Object.keys(SHEET_SCHEMAS).forEach(function (sheetName) {
    const headers = SHEET_SCHEMAS[sheetName];
    const sheet = getOrCreateSheet_(sheetName);

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      return;
    }

    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isDifferent = headers.some(function (header, index) {
      return currentHeaders[index] !== header;
    });

    if (isDifferent) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });
}

function getSpreadsheet_() {
  if (!APP_CONFIG.spreadsheetId || APP_CONFIG.spreadsheetId === 'PUT_YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('Set APP_CONFIG.spreadsheetId in Code.gs before deployment.');
  }

  return SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
}

function getOrCreateSheet_(sheetName) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function readRows_(sheetName) {
  const sheet = getOrCreateSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const headers = SHEET_SCHEMAS[sheetName];

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values.map(function (row, index) {
    const obj = { _rowNumber: index + 2 };
    headers.forEach(function (header, colIndex) {
      obj[header] = row[colIndex];
    });
    return obj;
  });
}

function appendRow_(sheetName, data) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SHEET_SCHEMAS[sheetName];
  const row = headers.map(function (header) {
    return data[header] === undefined ? '' : data[header];
  });
  sheet.appendRow(row);
}

function setCellByColumn_(sheetName, rowNumber, columnName, value) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SHEET_SCHEMAS[sheetName];
  const index = headers.indexOf(columnName);

  if (index === -1) {
    throw new Error('Column not found: ' + columnName);
  }

  sheet.getRange(rowNumber, index + 1).setValue(value);
}

function findUserById_(userId) {
  if (!userId) {
    return null;
  }

  const users = readRows_('users');
  return (
    users.find(function (row) {
      return String(row.userId) === String(userId);
    }) || null
  );
}

function findProjectById_(projectId) {
  if (!projectId) {
    return null;
  }

  const projects = readRows_('projects');
  return (
    projects.find(function (row) {
      return String(row.projectId) === String(projectId);
    }) || null
  );
}

function getUpdatesForProject_(projectId) {
  return readRows_('project_updates')
    .filter(function (update) {
      return String(update.projectId) === String(projectId);
    })
    .map(function (update) {
      return {
        updateId: String(update.updateId || ''),
        projectId: String(update.projectId || ''),
        assigneeUserId: String(update.assigneeUserId || ''),
        assigneeUsername: String(update.assigneeUsername || ''),
        remark: String(update.remark || ''),
        createdAt: toIsoString_(update.createdAt),
      };
    })
    .sort(function (a, b) {
      return toTimestamp_(b.createdAt) - toTimestamp_(a.createdAt);
    });
}

function projectResponse_(project) {
  return {
    projectId: String(project.projectId || ''),
    title: String(project.title || ''),
    description: String(project.description || ''),
    deadline: toIsoString_(project.deadline),
    assigneeUserId: String(project.assigneeUserId || ''),
    assigneeUsername: String(project.assigneeUsername || ''),
    createdByUserId: String(project.createdByUserId || ''),
    createdByUsername: String(project.createdByUsername || ''),
    createdAt: toIsoString_(project.createdAt),
    statusLatest: String(project.statusLatest || ''),
  };
}

function requireSession_(token, requiredRole) {
  const session = validateSession_(token);
  if (!session) {
    throw new Error('Unauthorized: invalid or expired token.');
  }

  if (requiredRole && session.role !== requiredRole) {
    throw new Error('Unauthorized: insufficient privileges.');
  }

  return session;
}

function validateSession_(token) {
  const tokenValue = sanitizeString_(token);
  if (!tokenValue) {
    return null;
  }

  const sessions = readRows_('sessions');
  const record = sessions.find(function (row) {
    return String(row.token) === tokenValue;
  });

  if (!record) {
    return null;
  }

  const nowTs = Date.now();
  const expiryTs = toTimestamp_(record.expiresAt);
  if (expiryTs <= nowTs) {
    removeSession_(record._rowNumber);
    return null;
  }

  return {
    token: String(record.token),
    userId: String(record.userId),
    username: String(record.username),
    role: String(record.role),
    createdAt: toIsoString_(record.createdAt),
    expiresAt: toIsoString_(record.expiresAt),
  };
}

function createSession_(data) {
  const token = generateToken_();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + APP_CONFIG.sessionExpiryDays * 24 * 60 * 60 * 1000);

  appendRow_('sessions', {
    token: token,
    userId: data.userId,
    username: data.username,
    role: data.role,
    createdAt: createdAt,
    expiresAt: expiresAt,
  });

  return {
    token: token,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function removeSession_(rowNumber) {
  const sheet = getOrCreateSheet_('sessions');
  const lastRow = sheet.getLastRow();
  if (rowNumber >= 2 && rowNumber <= lastRow) {
    sheet.deleteRow(rowNumber);
  }
}

function generateToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function generateNextId_(sheetName, idColumn, prefix, padLength) {
  const rows = readRows_(sheetName);
  let maxId = 0;

  rows.forEach(function (row) {
    const currentId = String(row[idColumn] || '');
    if (currentId.indexOf(prefix) !== 0) {
      return;
    }

    const numericPart = parseInt(currentId.slice(prefix.length), 10);
    if (!isNaN(numericPart) && numericPart > maxId) {
      maxId = numericPart;
    }
  });

  const next = maxId + 1;
  return prefix + ('000000' + next).slice(-padLength);
}

function sanitizeString_(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function parseBoolean_(value) {
  if (value === true || value === false) {
    return value;
  }

  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function normalizeDate_(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid deadline date format.');
  }
  return date;
}

function toIsoString_(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function toTimestamp_(value) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function createResponse_(obj, callback) {
  const payload = JSON.stringify(obj);
  const callbackName = sanitizeCallback_(callback);

  if (callbackName) {
    return ContentService
      .createTextOutput(callbackName + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(callback) {
  if (!callback) {
    return '';
  }

  const name = String(callback);
  if (/^[a-zA-Z_$][0-9a-zA-Z_$.]*$/.test(name)) {
    return name;
  }

  return '';
}

