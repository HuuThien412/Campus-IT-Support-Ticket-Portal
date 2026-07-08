const STORAGE_KEY = "campus-it-support-tickets";
const SESSION_KEY = "campus-it-support-session";
const APP_CONFIG = window.CAMPUS_SUPPORT_CONFIG || {};
const API_BASE_URL = APP_CONFIG.apiBaseUrl || "https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com";
const COGNITO_CONFIG = {
  enabled: Boolean(APP_CONFIG.cognito?.enabled),
  domain: APP_CONFIG.cognito?.domain || "",
  clientId: APP_CONFIG.cognito?.clientId || "",
  redirectUri: APP_CONFIG.cognito?.redirectUri || `${window.location.origin}${window.location.pathname}`,
  logoutUri: APP_CONFIG.cognito?.logoutUri || `${window.location.origin}${window.location.pathname}`
};
const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const viewSwitchButtons = document.querySelectorAll("[data-switch-view]");
const appViews = document.querySelectorAll("[data-app-view]");
const ticketTabButtons = document.querySelectorAll("[data-ticket-tab]");
const ticketPanels = document.querySelectorAll("[data-ticket-panel]");

const form = document.querySelector("#ticketForm");
const statusEl = document.querySelector("#formStatus");
const ticketConfirmation = document.querySelector("#ticketConfirmation");
const createdTicketId = document.querySelector("#createdTicketId");
const attachmentInput = document.querySelector("#attachment");
const attachmentPreview = document.querySelector("#attachmentPreview");
const ticketLookupInput = document.querySelector("#ticketLookupInput");
const ticketLookupButton = document.querySelector("#ticketLookupButton");
const ticketLookupStatus = document.querySelector("#ticketLookupStatus");
const ticketLookupResult = document.querySelector("#ticketLookupResult");
const lookupTicketId = document.querySelector("#lookupTicketId");
const lookupTicketStatus = document.querySelector("#lookupTicketStatus");
const lookupTicketCategory = document.querySelector("#lookupTicketCategory");
const lookupTicketPriority = document.querySelector("#lookupTicketPriority");
const lookupTicketUpdated = document.querySelector("#lookupTicketUpdated");
const lookupTicketNote = document.querySelector("#lookupTicketNote");
const adminStatusEl = document.querySelector("#adminStatus");
const storageStatus = document.querySelector("#storageStatus");
const tableBody = document.querySelector("#ticketsTable");
const totalCount = document.querySelector("#totalCount");
const openCount = document.querySelector("#openCount");
const highCount = document.querySelector("#highCount");
const resolvedCount = document.querySelector("#resolvedCount");
const refreshButton = document.querySelector("#refreshTickets");
const seedButton = document.querySelector("#seedData");
const clearButton = document.querySelector("#clearData");
const ticketSearch = document.querySelector("#ticketSearch");
const statusFilter = document.querySelector("#statusFilter");
const priorityFilter = document.querySelector("#priorityFilter");
const categoryFilter = document.querySelector("#categoryFilter");
const resetFilters = document.querySelector("#resetFilters");
const filterSummary = document.querySelector("#filterSummary");
const ticketDetailPanel = document.querySelector("#ticketDetailPanel");
const closeTicketDetail = document.querySelector("#closeTicketDetail");
const saveResolutionNote = document.querySelector("#saveResolutionNote");
const markOpenButton = document.querySelector("#markOpen");
const markInProgressButton = document.querySelector("#markInProgress");
const markResolvedButton = document.querySelector("#markResolved");
const detailTicketId = document.querySelector("#detailTicketId");
const detailRequester = document.querySelector("#detailRequester");
const detailEmail = document.querySelector("#detailEmail");
const detailCategory = document.querySelector("#detailCategory");
const detailPriority = document.querySelector("#detailPriority");
const detailStatus = document.querySelector("#detailStatus");
const detailCreated = document.querySelector("#detailCreated");
const detailLocation = document.querySelector("#detailLocation");
const detailDescription = document.querySelector("#detailDescription");
const detailAttachmentBlock = document.querySelector("#detailAttachmentBlock");
const detailAttachmentLink = document.querySelector("#detailAttachmentLink");
const detailAttachmentName = document.querySelector("#detailAttachmentName");
const detailAttachmentMeta = document.querySelector("#detailAttachmentMeta");
const resolutionNote = document.querySelector("#resolutionNote");
const detailUpdatedAt = document.querySelector("#detailUpdatedAt");
const authModal = document.querySelector("#authModal");
const loginButton = document.querySelector("#loginButton");
const signupButton = document.querySelector("#signupButton");
const logoutButton = document.querySelector("#logoutButton");
const closeAuthModal = document.querySelector("#closeAuthModal");
const loginForm = document.querySelector("#loginForm");
const loginRole = document.querySelector("#loginRole");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginStatus = document.querySelector("#loginStatus");
const signupLink = document.querySelector("#signupLink");
const sessionChip = document.querySelector("#sessionChip");
const fullNameInput = document.querySelector("#fullName");
const requesterEmailInput = document.querySelector("#email");

const STATUS_LABELS = {
  Open: "Mới",
  "In Progress": "Đang xử lý",
  Resolved: "Đã giải quyết"
};

let selectedTicketId = null;
let pendingAuthView = "user";
let ticketCache = [];

const DEMO_ACCOUNTS = {
  user: {
    role: "user",
    name: "Nguyễn Văn A",
    email: "student@campus.edu.vn",
    password: "student123",
    label: "User / Student"
  },
  admin: {
    role: "admin",
    name: "IT Admin",
    email: "admin@campus.edu.vn",
    password: "admin123",
    label: "Admin / IT Staff"
  }
};

function getTickets() {
  if (ticketCache.length) {
    return ticketCache;
  }

  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(normalizeTicket);
  } catch {
    return [];
  }
}

function saveTickets(items) {
  ticketCache = items.map(normalizeTicket);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ticketCache));
}

function normalizeAttachment(ticket) {
  if (ticket.attachment?.url || ticket.attachment?.fileName || ticket.attachment?.key) {
    return ticket.attachment;
  }

  if (ticket.attachmentUrl || ticket.attachmentName || ticket.attachmentKey) {
    return {
      url: ticket.attachmentUrl || "",
      key: ticket.attachmentKey || "",
      fileName: ticket.attachmentName || "attachment",
      contentType: ticket.attachmentType || "",
      size: Number(ticket.attachmentSize || 0)
    };
  }

  return null;
}

function normalizeTicket(ticket) {
  const id = ticket.id || ticket.ticketId;

  return {
    ...ticket,
    id,
    ticketId: id,
    status: ticket.status || "Open",
    priority: ticket.priority || "Medium",
    resolutionNote: ticket.resolutionNote || "",
    attachment: normalizeAttachment(ticket)
  };
}

function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));

    if (session?.expiresAt && Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function isCognitoEnabled() {
  return Boolean(COGNITO_CONFIG.enabled && COGNITO_CONFIG.domain && COGNITO_CONFIG.clientId);
}

function normalizeCognitoDomain(domain) {
  if (!domain) {
    return "";
  }

  return domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
}

function decodeJwtPayload(token) {
  if (!token) {
    return {};
  }

  try {
    const payload = token.split(".")[1] || "";
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "="));
    return JSON.parse(decodedPayload);
  } catch {
    return {};
  }
}

function getRoleFromCognitoGroups(groups = []) {
  const normalizedGroups = Array.isArray(groups)
    ? groups
    : String(groups || "").split(",").map((group) => group.trim()).filter(Boolean);

  if (normalizedGroups.includes("Admins") || normalizedGroups.includes("Admin")) {
    return "admin";
  }

  return "user";
}

function buildCognitoLoginUrl(role = "user") {
  const domain = normalizeCognitoDomain(COGNITO_CONFIG.domain);
  const url = new URL(`${domain}/oauth2/authorize`);

  url.searchParams.set("client_id", COGNITO_CONFIG.clientId);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", COGNITO_CONFIG.redirectUri);
  url.searchParams.set("state", role === "admin" ? "admin" : "user");

  return url.toString();
}

function buildCognitoSignupUrl() {
  const domain = normalizeCognitoDomain(COGNITO_CONFIG.domain);
  const url = new URL(`${domain}/signup`);

  url.searchParams.set("client_id", COGNITO_CONFIG.clientId);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", COGNITO_CONFIG.redirectUri);
  url.searchParams.set("state", "user");

  return url.toString();
}

function buildCognitoLogoutUrl() {
  const domain = normalizeCognitoDomain(COGNITO_CONFIG.domain);
  const url = new URL(`${domain}/logout`);

  url.searchParams.set("client_id", COGNITO_CONFIG.clientId);
  url.searchParams.set("logout_uri", COGNITO_CONFIG.logoutUri);

  return url.toString();
}

function getAuthorizationToken() {
  const session = getSession();
  return session?.accessToken || session?.idToken || "";
}

function handleCognitoCallback() {
  if (!isCognitoEnabled() || !location.hash.includes("access_token")) {
    return "";
  }

  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");
  const expiresIn = Number(params.get("expires_in") || 3600);
  const state = params.get("state") || "user";
  const claims = decodeJwtPayload(idToken || accessToken);
  const groups = claims["cognito:groups"] || [];
  const role = getRoleFromCognitoGroups(groups);
  const email = claims.email || claims.username || claims["cognito:username"] || "";

  saveSession({
    role,
    name: claims.name || email || (role === "admin" ? "Admin" : "User"),
    email,
    provider: "cognito",
    accessToken,
    idToken,
    expiresAt: Date.now() + expiresIn * 1000,
    loggedInAt: new Date().toISOString()
  });

  history.replaceState(null, "", COGNITO_CONFIG.redirectUri);
  return role === "admin" || state === "admin" ? "admin" : "user";
}

function applyVisibleView(nextView) {
  appViews.forEach((view) => {
    view.hidden = view.dataset.appView !== nextView;
  });

  document.querySelectorAll(".switch-button, .nav-actions [data-switch-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.switchView === nextView);
  });
}

function prefillLogin(role) {
  const account = DEMO_ACCOUNTS[role === "admin" ? "admin" : "user"];

  if (loginRole) {
    loginRole.value = account.role;
  }

  if (loginEmail) {
    loginEmail.value = account.email;
  }

  if (loginPassword) {
    loginPassword.value = account.password;
  }
}

function openAuthModal(role = "user") {
  pendingAuthView = role === "admin" ? "admin" : "user";

  if (isCognitoEnabled()) {
    window.location.href = buildCognitoLoginUrl(pendingAuthView);
    return;
  }

  prefillLogin(pendingAuthView);
  setStatus(loginStatus, "", "");

  if (authModal) {
    authModal.hidden = false;
    loginEmail?.focus();
  }
}

function openSignup() {
  pendingAuthView = "user";

  if (isCognitoEnabled()) {
    window.location.href = buildCognitoSignupUrl();
    return;
  }

  openAuthModal("user");
  setStatus(loginStatus, "Đăng ký tự phục vụ sẽ hoạt động sau khi bật Cognito trong Amplify.", "");
}

function closeAuthDialog() {
  if (authModal) {
    authModal.hidden = true;
  }
}

function syncRequesterFields() {
  const session = getSession();

  if (session?.role !== "user") {
    return;
  }

  if (fullNameInput && !fullNameInput.value.trim()) {
    fullNameInput.value = session.name;
  }

  if (requesterEmailInput && !requesterEmailInput.value.trim()) {
    requesterEmailInput.value = session.email;
  }
}

function renderSession() {
  const session = getSession();

  if (!sessionChip) {
    return;
  }

  sessionChip.classList.remove("is-user", "is-admin");

  if (!session) {
    sessionChip.innerHTML = '<i class="ti ti-user-circle" aria-hidden="true"></i> Chưa đăng nhập';
    loginButton.hidden = false;
    signupButton.hidden = false;
    logoutButton.hidden = true;
    return;
  }

  const roleLabel = session.role === "admin" ? "Admin" : "User";
  sessionChip.classList.add(session.role === "admin" ? "is-admin" : "is-user");
  sessionChip.innerHTML = `<i class="ti ti-shield-check" aria-hidden="true"></i> ${roleLabel}: ${escapeHtml(session.email)}`;
  loginButton.hidden = true;
  signupButton.hidden = true;
  logoutButton.hidden = false;
  syncRequesterFields();
}

function showAppView(viewName, options = {}) {
  const nextView = viewName === "admin" ? "admin" : "user";
  const session = getSession();

  if (nextView === "admin" && session?.role !== "admin") {
    applyVisibleView("user");
    openAuthModal("admin");
    return false;
  }

  applyVisibleView(nextView);

  if (nextView === "admin") {
    renderTickets();
    fetchTicketsFromApi();
  }

  if (options.updateAddress !== false) {
    if (nextView === "admin") {
      const adminPath = location.pathname.includes("/admin") ? location.pathname : "#admin";
      history.replaceState(null, "", adminPath);
    } else {
      history.replaceState(null, "", "/");
    }
  }

  if (options.scrollTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderSession();
  return true;
}

function activateTicketTab(tabName) {
  const nextTab = tabName === "attachment" ? "attachment" : "basic";

  ticketTabButtons.forEach((button) => {
    const isActive = button.dataset.ticketTab === nextTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  ticketPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.ticketPanel === nextTab);
  });
}

function updateStorageStatus() {
  if (!storageStatus) {
    return;
  }

  const tickets = getTickets();
  storageStatus.textContent = `Dong bo AWS API: ${tickets.length} ticket tu DynamoDB. Trinh duyet chi luu cache tam thoi de demo nhanh.`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);

  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function validateAttachment(file) {
  if (!file) {
    return null;
  }

  const hasAllowedType = ALLOWED_ATTACHMENT_TYPES.includes(file.type);
  const hasAllowedExtension = /\.(pdf|png|jpe?g|webp)$/i.test(file.name);

  if (!hasAllowedType && !hasAllowedExtension) {
    throw new Error("Chỉ hỗ trợ tệp PDF, PNG, JPG hoặc WebP.");
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(`Tệp đính kèm tối đa ${formatBytes(MAX_ATTACHMENT_SIZE)}.`);
  }

  return file;
}

function readAttachmentFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    try {
      validateAttachment(file);
    } catch (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const data = result.includes(",") ? result.split(",")[1] : result;

      resolve({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        data
      });
    };

    reader.onerror = () => reject(new Error("Không thể đọc tệp đính kèm."));
    reader.readAsDataURL(file);
  });
}

function renderAttachmentPreview() {
  if (!attachmentInput || !attachmentPreview) {
    return;
  }

  const file = attachmentInput.files?.[0];

  if (!file) {
    attachmentPreview.hidden = true;
    attachmentPreview.textContent = "";
    return;
  }

  attachmentPreview.hidden = false;

  try {
    validateAttachment(file);
    attachmentPreview.classList.remove("is-error");
    attachmentPreview.innerHTML = `
      <i class="ti ti-paperclip" aria-hidden="true"></i>
      <span>${escapeHtml(file.name)}</span>
      <small>${formatBytes(file.size)}</small>
    `;
  } catch (error) {
    attachmentPreview.classList.add("is-error");
    attachmentPreview.innerHTML = `
      <i class="ti ti-alert-circle" aria-hidden="true"></i>
      <span>${escapeHtml(error.message)}</span>
    `;
  }
}

function setStatus(target, message, type) {
  if (!target) {
    return;
  }

  const baseClass = target.classList.contains("admin-status") ? "admin-status" : "form-status";
  target.textContent = message;
  target.className = `${baseClass} ${type || ""}`;
}

function createTicketId() {
  const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IT-${datePart}-${randomPart}`;
}

function createTicket(payload) {
  const tickets = getTickets();
  const record = {
    id: createTicketId(),
    fullName: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    category: payload.category,
    priority: payload.priority,
    location: payload.location.trim(),
    description: payload.description.trim(),
    attachment: payload.attachment || null,
    status: "Open",
    resolutionNote: "",
    createdAt: new Date().toISOString()
  };

  saveTickets([record, ...tickets]);

  return {
    ok: true,
    ticketId: record.id,
    message: `Đã tạo ticket ${record.id}. Vui lòng lưu lại mã này để tiện theo dõi.`
  };
}

function updateTicketStatus(ticketId, nextStatus) {
  const tickets = getTickets().map((ticket) => {
    if (ticket.id !== ticketId) {
      return ticket;
    }

    return {
      ...ticket,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };
  });

  saveTickets(tickets);
  renderTickets();

  if (selectedTicketId === ticketId) {
    renderTicketDetail(ticketId);
  }
}

async function apiRequest(path, options = {}) {
  const token = getAuthorizationToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `API request failed with status ${response.status}`);
  }

  return data;
}

async function fetchTicketsFromApi(options = {}) {
  try {
    const data = await apiRequest("/tickets");
    saveTickets(data.tickets || []);
    renderTickets();
    updateStorageStatus();

    if (options.showStatus) {
      setStatus(adminStatusEl, "Đã đồng bộ danh sách ticket từ DynamoDB.", "success");
    }

    return getTickets();
  } catch (error) {
    console.error(error);

    if (options.showStatus) {
      setStatus(adminStatusEl, `Không thể tải ticket từ AWS API: ${error.message}`, "error");
    }

    renderTickets();
    return getTickets();
  }
}

function renderTicketLookupResult(ticket) {
  if (!ticketLookupResult) {
    return;
  }

  if (lookupTicketId) {
    lookupTicketId.textContent = ticket.id || ticket.ticketId || "--";
  }
  if (lookupTicketStatus) {
    lookupTicketStatus.textContent = statusLabel(ticket.status);
  }
  if (lookupTicketCategory) {
    lookupTicketCategory.textContent = ticket.category || "--";
  }
  if (lookupTicketPriority) {
    lookupTicketPriority.textContent = ticket.priority || "--";
  }
  if (lookupTicketUpdated) {
    lookupTicketUpdated.textContent = ticket.updatedAt
      ? formatTime(ticket.updatedAt)
      : ticket.createdAt
        ? formatTime(ticket.createdAt)
        : "--";
  }
  if (lookupTicketNote) {
    lookupTicketNote.textContent = ticket.resolutionNote?.trim() || "Chưa có ghi chú xử lý.";
  }

  ticketLookupResult.hidden = false;
}

async function lookupTicketByCode() {
  if (!ticketLookupInput) {
    return;
  }

  const lookupCode = ticketLookupInput.value.trim().toUpperCase();

  if (!lookupCode) {
    if (ticketLookupResult) {
      ticketLookupResult.hidden = true;
    }
    setStatus(ticketLookupStatus, "Nhập mã ticket để tra cứu trạng thái.", "error");
    ticketLookupInput.focus();
    return;
  }

  if (ticketLookupButton) {
    ticketLookupButton.disabled = true;
  }

  setStatus(ticketLookupStatus, "Đang tra cứu ticket từ DynamoDB...", "");

  try {
    let ticket = null;

    try {
      const directData = await apiRequest(`/tickets/${encodeURIComponent(lookupCode)}`);
      ticket = normalizeTicket(directData.ticket || {});
      saveTickets([ticket, ...getTickets().filter((item) => item.id !== ticket.id)]);
    } catch {
      const data = await apiRequest("/tickets");
      saveTickets(data.tickets || []);
      ticket = getTickets().find((item) =>
        String(item.id || item.ticketId || "").toUpperCase() === lookupCode
      );
    }

    if (!ticket) {
      if (ticketLookupResult) {
        ticketLookupResult.hidden = true;
      }
      setStatus(ticketLookupStatus, `Không tìm thấy ticket ${lookupCode}. Kiểm tra lại mã đã lưu.`, "error");
      return;
    }

    renderTicketLookupResult(ticket);
    setStatus(ticketLookupStatus, `Đã tìm thấy ticket ${lookupCode}.`, "success");
  } catch (error) {
    console.error(error);

    if (ticketLookupResult) {
      ticketLookupResult.hidden = true;
    }

    setStatus(ticketLookupStatus, `Không thể tra cứu ticket: ${error.message}`, "error");
  } finally {
    if (ticketLookupButton) {
      ticketLookupButton.disabled = false;
    }
  }
}

async function createTicketRemote(payload) {
  const record = {
    fullName: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    category: payload.category,
    priority: payload.priority,
    location: payload.location.trim(),
    description: payload.description.trim(),
    attachment: payload.attachment || null
  };

  const data = await apiRequest("/tickets", {
    method: "POST",
    body: JSON.stringify(record)
  });

  const ticket = normalizeTicket(data.ticket || {});
  saveTickets([ticket, ...getTickets().filter((item) => item.id !== ticket.id)]);

  return {
    ok: true,
    ticketId: ticket.id,
    message: `Đã tạo ticket ${ticket.id} trên AWS. Vui lòng lưu lại mã này để tiện theo dõi.`
  };
}

async function patchTicketRemote(ticketId, payload) {
  const data = await apiRequest(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

  const updatedTicket = normalizeTicket(data.ticket || { id: ticketId, ...payload });
  saveTickets(getTickets().map((ticket) => (ticket.id === ticketId ? updatedTicket : ticket)));
  return updatedTicket;
}

async function updateTicketStatusRemote(ticketId, nextStatus) {
  const currentTicket = findTicket(ticketId);

  await patchTicketRemote(ticketId, {
    status: nextStatus,
    resolutionNote: currentTicket?.resolutionNote || ""
  });

  renderTickets();

  if (selectedTicketId === ticketId) {
    renderTicketDetail(ticketId);
  }
}

function statusClass(value) {
  return String(value || "Open").toLowerCase().replaceAll(" ", "-");
}

function priorityClass(value) {
  return String(value || "Medium").toLowerCase();
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value || "Mới";
}

function statusOption(currentStatus, value) {
  return `<option value="${value}" ${currentStatus === value ? "selected" : ""}>${statusLabel(value)}</option>`;
}

function getActiveFilters() {
  return {
    search: ticketSearch?.value.trim().toLowerCase() || "",
    status: statusFilter?.value || "all",
    priority: priorityFilter?.value || "all",
    category: categoryFilter?.value || "all"
  };
}

function ticketMatchesFilters(ticket, filters) {
  const searchableText = [
    ticket.id,
    ticket.fullName,
    ticket.email,
    ticket.category,
    ticket.priority,
    ticket.status,
    ticket.location,
    ticket.description
  ].join(" ").toLowerCase();

  const matchesSearch = !filters.search || searchableText.includes(filters.search);
  const matchesStatus = filters.status === "all" || ticket.status === filters.status;
  const matchesPriority = filters.priority === "all" || ticket.priority === filters.priority;
  const matchesCategory = filters.category === "all" || ticket.category === filters.category;

  return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
}

function renderAttachmentCell(ticket) {
  const attachment = ticket.attachment;

  if (!attachment?.url) {
    return '<span class="muted-cell">Không</span>';
  }

  const name = attachment.fileName || "Tệp";

  return `
    <a class="attachment-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(name)}">
      <i class="ti ti-paperclip" aria-hidden="true"></i>
      <span>${escapeHtml(name)}</span>
    </a>
  `;
}

function renderTickets() {
  if (!tableBody) {
    return;
  }

  const tickets = getTickets();
  const filters = getActiveFilters();
  const filteredTickets = tickets.filter((ticket) => ticketMatchesFilters(ticket, filters));
  const highPriorityTickets = tickets.filter((ticket) => ["Critical", "High"].includes(ticket.priority));

  if (totalCount) {
    totalCount.textContent = tickets.length;
  }
  if (openCount) {
    openCount.textContent = tickets.filter((ticket) => ticket.status !== "Resolved").length;
  }
  if (highCount) {
    highCount.textContent = highPriorityTickets.length;
  }
  if (resolvedCount) {
    resolvedCount.textContent = tickets.filter((ticket) => ticket.status === "Resolved").length;
  }
  if (filterSummary) {
    filterSummary.textContent = `Hiển thị ${filteredTickets.length} / ${tickets.length} ticket`;
  }

  updateStorageStatus();

  if (!tickets.length) {
    tableBody.innerHTML = '<tr><td class="empty-row" colspan="9">Chưa có ticket hỗ trợ.</td></tr>';
    return;
  }

  if (!filteredTickets.length) {
    tableBody.innerHTML = '<tr><td class="empty-row" colspan="9">Không có ticket nào khớp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredTickets.map((ticket) => `
    <tr>
      <td><span class="ticket-id">${escapeHtml(ticket.id)}</span></td>
      <td>${renderAttachmentCell(ticket)}</td>
      <td>
        <span class="requester-name">${escapeHtml(ticket.fullName)}</span>
        <span class="requester-email">${escapeHtml(ticket.email)}</span>
      </td>
      <td class="category-cell">${escapeHtml(ticket.category)}</td>
      <td><span class="badge priority-${priorityClass(ticket.priority)}">${escapeHtml(ticket.priority)}</span></td>
      <td><span class="badge status-${statusClass(ticket.status)}">${escapeHtml(statusLabel(ticket.status))}</span></td>
      <td>${formatTime(ticket.createdAt)}</td>
      <td>
        <button class="button button-outline details-button" type="button" data-detail-id="${escapeHtml(ticket.id)}">
          <i class="ti ti-eye" aria-hidden="true"></i>
          Chi tiết
        </button>
      </td>
      <td>
        <select class="status-select" data-ticket-id="${escapeHtml(ticket.id)}" aria-label="Cập nhật trạng thái ticket ${escapeHtml(ticket.id)}">
          ${statusOption(ticket.status, "Open")}
          ${statusOption(ticket.status, "In Progress")}
          ${statusOption(ticket.status, "Resolved")}
        </select>
      </td>
    </tr>
  `).join("");
}

function findTicket(ticketId) {
  return getTickets().find((ticket) => ticket.id === ticketId);
}

function renderTicketAttachment(ticket) {
  const attachment = ticket.attachment;

  if (!detailAttachmentBlock) {
    return;
  }

  if (!attachment?.url) {
    detailAttachmentBlock.hidden = true;
    return;
  }

  detailAttachmentBlock.hidden = false;

  if (detailAttachmentLink) {
    detailAttachmentLink.href = attachment.url;
  }

  if (detailAttachmentName) {
    detailAttachmentName.textContent = attachment.fileName || "Tệp đính kèm";
  }

  if (detailAttachmentMeta) {
    detailAttachmentMeta.textContent = [
      attachment.contentType || "",
      attachment.size ? formatBytes(attachment.size) : ""
    ].filter(Boolean).join(" • ");
  }
}

function renderTicketDetail(ticketId) {
  if (!ticketDetailPanel) {
    return;
  }

  const ticket = findTicket(ticketId);

  if (!ticket) {
    ticketDetailPanel.hidden = true;
    selectedTicketId = null;
    return;
  }

  selectedTicketId = ticket.id;
  ticketDetailPanel.hidden = false;
  detailTicketId.textContent = ticket.id;
  detailRequester.textContent = ticket.fullName || "--";
  detailEmail.textContent = ticket.email || "--";
  detailCategory.textContent = ticket.category || "--";
  detailPriority.textContent = ticket.priority || "--";
  detailStatus.textContent = statusLabel(ticket.status);
  detailCreated.textContent = ticket.createdAt ? formatTime(ticket.createdAt) : "--";
  detailLocation.textContent = ticket.location || "--";
  detailDescription.textContent = ticket.description || "--";
  renderTicketAttachment(ticket);
  resolutionNote.value = ticket.resolutionNote || "";
  detailUpdatedAt.textContent = ticket.updatedAt ? `Cập nhật lần cuối: ${formatTime(ticket.updatedAt)}` : "";
  syncDetailStatusButtons(ticket.status);
  ticketDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncDetailStatusButtons(currentStatus = "Open") {
  if (markOpenButton) {
    markOpenButton.disabled = currentStatus === "Open";
  }

  if (markInProgressButton) {
    markInProgressButton.disabled = currentStatus === "In Progress";
  }

  if (markResolvedButton) {
    markResolvedButton.disabled = currentStatus === "Resolved";
  }
}

function setDetailActionButtonsDisabled(disabled) {
  [markOpenButton, markInProgressButton, markResolvedButton, saveResolutionNote].forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
}

async function updateSelectedTicketStatus(nextStatus) {
  if (!selectedTicketId) {
    return;
  }

  const currentTicket = findTicket(selectedTicketId);
  const nextLabel = statusLabel(nextStatus);
  const note = resolutionNote?.value.trim() || currentTicket?.resolutionNote || "";

  setDetailActionButtonsDisabled(true);

  if (detailUpdatedAt) {
    detailUpdatedAt.textContent = `Đang chuyển trạng thái sang ${nextLabel}...`;
  }

  setStatus(adminStatusEl, `Đang cập nhật ${selectedTicketId} sang ${nextLabel}...`, "");

  try {
    const updatedTicket = await patchTicketRemote(selectedTicketId, {
      status: nextStatus,
      resolutionNote: note
    });

    renderTickets();
    renderTicketDetail(selectedTicketId);

    if (detailUpdatedAt) {
      const updatedAt = updatedTicket.updatedAt || new Date().toISOString();
      detailUpdatedAt.textContent = `Đã chuyển sang ${nextLabel}. Cập nhật: ${formatTime(updatedAt)}`;
    }

    setStatus(adminStatusEl, `Đã cập nhật ${selectedTicketId} sang ${nextLabel}.`, "success");
  } catch (error) {
    console.error(error);

    if (detailUpdatedAt) {
      detailUpdatedAt.textContent = `Không thể cập nhật trạng thái: ${error.message}`;
    }

    setStatus(adminStatusEl, `Không thể cập nhật trạng thái: ${error.message}`, "error");
  } finally {
    setDetailActionButtonsDisabled(false);
    syncDetailStatusButtons(findTicket(selectedTicketId)?.status || currentTicket?.status || "Open");
  }
}

function saveTicketResolutionNote() {
  if (!selectedTicketId) {
    return;
  }

  const tickets = getTickets().map((ticket) => {
    if (ticket.id !== selectedTicketId) {
      return ticket;
    }

    return {
      ...ticket,
      resolutionNote: resolutionNote.value.trim(),
      updatedAt: new Date().toISOString()
    };
  });

  saveTickets(tickets);
  renderTickets();
  renderTicketDetail(selectedTicketId);
  setStatus(adminStatusEl, `Đã lưu ghi chú xử lý cho ${selectedTicketId}.`, "success");
}

async function saveTicketResolutionNoteRemote() {
  if (!selectedTicketId) {
    return;
  }

  const currentTicket = findTicket(selectedTicketId);
  setStatus(adminStatusEl, "Đang lưu ghi chú xử lý lên DynamoDB...", "");

  try {
    await patchTicketRemote(selectedTicketId, {
      status: currentTicket?.status || "In Progress",
      resolutionNote: resolutionNote.value.trim()
    });
    renderTickets();
    renderTicketDetail(selectedTicketId);
    setStatus(adminStatusEl, `Đã lưu ghi chú xử lý cho ${selectedTicketId}.`, "success");
  } catch (error) {
    console.error(error);
    setStatus(adminStatusEl, `Không thể lưu ghi chú xử lý: ${error.message}`, "error");
  }
}

async function saveTicketResolutionNoteWithInlineFeedback() {
  if (!selectedTicketId) {
    return;
  }

  const originalButtonText = saveResolutionNote?.textContent || "Luu ghi chu";
  const currentTicket = findTicket(selectedTicketId);
  const note = resolutionNote.value.trim();

  if (saveResolutionNote) {
    saveResolutionNote.disabled = true;
    saveResolutionNote.textContent = "Dang luu...";
  }

  if (detailUpdatedAt) {
    detailUpdatedAt.textContent = "Dang luu ghi chu len DynamoDB...";
  }

  setStatus(adminStatusEl, "Dang luu ghi chu xu ly len DynamoDB...", "");

  try {
    const updatedTicket = await patchTicketRemote(selectedTicketId, {
      status: currentTicket?.status || "In Progress",
      resolutionNote: note
    });

    renderTickets();
    renderTicketDetail(selectedTicketId);

    if (detailUpdatedAt) {
      const updatedAt = updatedTicket.updatedAt || new Date().toISOString();
      detailUpdatedAt.textContent = `Da luu ghi chu cho ${selectedTicketId}. Cap nhat: ${formatTime(updatedAt)}`;
    }

    setStatus(adminStatusEl, `Da luu ghi chu xu ly cho ${selectedTicketId}.`, "success");
  } catch (error) {
    console.error(error);

    if (detailUpdatedAt) {
      detailUpdatedAt.textContent = `Khong the luu ghi chu: ${error.message}`;
    }

    setStatus(adminStatusEl, `Khong the luu ghi chu xu ly: ${error.message}`, "error");
  } finally {
    if (saveResolutionNote) {
      saveResolutionNote.disabled = false;
      saveResolutionNote.textContent = originalButtonText.trim() || "Luu ghi chu";
    }
  }
}

async function seedTicketsRemote() {
  const samples = [
    {
      fullName: "Nguyen Minh Anh",
      email: "minhanh@example.edu.vn",
      category: "WiFi",
      priority: "Critical",
      location: "Phong lab B203, toa B",
      description: "Khong the ket noi WiFi trong phong lab, ca nhom thuc hanh bi anh huong."
    },
    {
      fullName: "Tran Quoc Bao",
      email: "quocbao@example.edu.vn",
      category: "Account",
      priority: "High",
      location: "Cong LMS",
      description: "Tai khoan LMS bi khoa sau nhieu lan dang nhap that bai."
    },
    {
      fullName: "Le Thu Ha",
      email: "thuha@example.edu.vn",
      category: "Software",
      priority: "Low",
      location: "May lab C104-12",
      description: "Can cai phan mem hoc tap tren may thuc hanh de chuan bi buoi hoc."
    }
  ];

  setStatus(adminStatusEl, "Dang tao du lieu mau tren DynamoDB...", "");

  try {
    for (const sample of samples) {
      await createTicketRemote(sample);
    }

    await fetchTicketsFromApi();
    setStatus(adminStatusEl, "Da tao du lieu mau tren DynamoDB.", "success");
  } catch (error) {
    console.error(error);
    setStatus(adminStatusEl, `Khong the tao du lieu mau: ${error.message}`, "error");
  }
}

viewSwitchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showAppView(button.dataset.switchView, { scrollTop: true });
  });
});

loginButton?.addEventListener("click", () => {
  const activeView = document.querySelector("[data-app-view]:not([hidden])")?.dataset.appView;
  openAuthModal(activeView === "admin" ? "admin" : "user");
});

signupButton?.addEventListener("click", openSignup);
signupLink?.addEventListener("click", openSignup);

logoutButton?.addEventListener("click", () => {
  const session = getSession();
  clearSession();

  if (session?.provider === "cognito" && isCognitoEnabled()) {
    window.location.href = buildCognitoLogoutUrl();
    return;
  }

  renderSession();
  showAppView("user", { scrollTop: true });
});

closeAuthModal?.addEventListener("click", closeAuthDialog);

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) {
    closeAuthDialog();
  }
});

loginRole?.addEventListener("change", () => {
  prefillLogin(loginRole.value);
});

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const role = loginRole.value === "admin" ? "admin" : "user";
  const account = DEMO_ACCOUNTS[role];

  if (loginEmail.value.trim().toLowerCase() !== account.email || loginPassword.value !== account.password) {
    setStatus(loginStatus, "Email hoặc mật khẩu demo không đúng.", "error");
    return;
  }

  saveSession({
    role: account.role,
    name: account.name,
    email: account.email,
    loggedInAt: new Date().toISOString()
  });

  renderSession();
  closeAuthDialog();
  showAppView(role === "admin" || pendingAuthView === "admin" ? "admin" : "user", { scrollTop: true });
});

ticketTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTicketTab(button.dataset.ticketTab);
  });
});

attachmentInput?.addEventListener("change", renderAttachmentPreview);

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    activateTicketTab("basic");

    const session = getSession();

    if (!session) {
      setStatus(statusEl, "Bạn cần đăng nhập User demo trước khi gửi ticket.", "error");
      openAuthModal("user");
      return;
    }

    if (session.role !== "user") {
      setStatus(statusEl, "Tài khoản Admin chỉ dùng để xử lý ticket. Hãy đăng nhập User để gửi yêu cầu.", "error");
      return;
    }

    syncRequesterFields();

    if (!form.reportValidity()) {
      setStatus(statusEl, "Vui lòng điền đầy đủ các trường bắt buộc trong tab Thông tin cơ bản.", "error");
      activateTicketTab("basic");
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    setStatus(statusEl, "Đang chuẩn bị tệp đính kèm...", "");

    try {
      const file = attachmentInput?.files?.[0] || null;
      payload.attachment = await readAttachmentFile(file);
    } catch (error) {
      setStatus(statusEl, error.message, "error");
      activateTicketTab("attachment");
      return;
    }

    setStatus(statusEl, "Đang gửi ticket lên AWS...", "");

    let result;

    try {
      result = await createTicketRemote(payload);
    } catch (error) {
      console.error(error);
      setStatus(statusEl, `Không thể gửi ticket lên AWS API: ${error.message}`, "error");
      return;
    }

    setStatus(statusEl, result.message, result.ok ? "success" : "error");

    if (result.ok) {
      if (createdTicketId && ticketConfirmation) {
        createdTicketId.textContent = `Mã ticket của bạn: ${result.ticketId}`;
        ticketConfirmation.hidden = false;
      }
      if (ticketLookupInput) {
        ticketLookupInput.value = result.ticketId;
      }
      form.reset();
      renderAttachmentPreview();
      activateTicketTab("basic");
      renderTickets();
    }
  });
}

ticketLookupButton?.addEventListener("click", lookupTicketByCode);

ticketLookupInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    lookupTicketByCode();
  }
});

if (tableBody) {
  tableBody.addEventListener("change", async (event) => {
    const select = event.target.closest(".status-select");
    if (!select) {
      return;
    }

    const previousValue = findTicket(select.dataset.ticketId)?.status || "Open";
    select.disabled = true;
    setStatus(adminStatusEl, "Đang cập nhật trạng thái lên DynamoDB...", "");

    try {
      await updateTicketStatusRemote(select.dataset.ticketId, select.value);
      setStatus(adminStatusEl, `Đã cập nhật trạng thái ${select.dataset.ticketId} thành ${statusLabel(select.value)}.`, "success");
    } catch (error) {
      console.error(error);
      select.value = previousValue;
      setStatus(adminStatusEl, `Không thể cập nhật trạng thái: ${error.message}`, "error");
    } finally {
      select.disabled = false;
    }
    return;
    setStatus(adminStatusEl, `Đã cập nhật trạng thái ${select.dataset.ticketId} thành ${statusLabel(select.value)}.`, "success");
  });

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-detail-id]");
    if (!button) {
      return;
    }

    renderTicketDetail(button.dataset.detailId);
  });
}

[ticketSearch, statusFilter, priorityFilter, categoryFilter].forEach((control) => {
  control?.addEventListener("input", renderTickets);
});

refreshButton?.addEventListener("click", () => {
  refreshButton.disabled = true;
  fetchTicketsFromApi({ showStatus: true }).finally(() => {
    refreshButton.disabled = false;
  });
});

resetFilters?.addEventListener("click", () => {
  ticketSearch.value = "";
  statusFilter.value = "all";
  priorityFilter.value = "all";
  categoryFilter.value = "all";
  renderTickets();
});

seedButton?.addEventListener("click", () => {
  seedTicketsRemote();
});

clearButton?.addEventListener("click", () => {
  saveTickets([]);
  selectedTicketId = null;

  if (ticketDetailPanel) {
    ticketDetailPanel.hidden = true;
  }

  setStatus(adminStatusEl, "Đã xóa cache ticket trong trình duyệt này. Dữ liệu DynamoDB không bị xóa.", "");
  renderTickets();
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    renderTickets();
    setStatus(adminStatusEl, "Đã nhận dữ liệu ticket mới từ tab khác.", "success");
  }
});

window.addEventListener("focus", renderTickets);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderTickets();
  }
});

window.addEventListener("hashchange", () => {
  if (location.hash === "#admin") {
    showAppView("admin", { updateAddress: false });
  }
});

closeTicketDetail?.addEventListener("click", () => {
  ticketDetailPanel.hidden = true;
  selectedTicketId = null;
});

saveResolutionNote?.addEventListener("click", saveTicketResolutionNoteWithInlineFeedback);
markOpenButton?.addEventListener("click", () => updateSelectedTicketStatus("Open"));
markInProgressButton?.addEventListener("click", () => updateSelectedTicketStatus("In Progress"));
markResolvedButton?.addEventListener("click", () => updateSelectedTicketStatus("Resolved"));

const cognitoRedirectView = handleCognitoCallback();
const initialView = cognitoRedirectView || (location.hash === "#admin" || document.body.dataset.initialView === "admin" ? "admin" : "user");
renderSession();
showAppView(initialView, { updateAddress: false });
activateTicketTab("basic");
renderTickets();
updateStorageStatus();



