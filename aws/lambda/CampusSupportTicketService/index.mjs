import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME || "CampusSupportTickets";
const ATTACHMENT_BUCKET = process.env.ATTACHMENT_BUCKET || "campus-it-support-portal-894566155018";
const ATTACHMENT_PREFIX = process.env.ATTACHMENT_PREFIX || "attachments";
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  "http://campus-it-support-portal-894566155018.s3-website-ap-southeast-1.amazonaws.com";
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const AUTH_MODE = process.env.AUTH_MODE || "demo";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-amz-date,x-api-key",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
  },
  body: JSON.stringify(body)
});

const createTicketId = () => {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IT-${date}-${random}`;
};

const safeFileName = (name = "attachment") => {
  const cleanName = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleanName || "attachment";
};

const publicObjectUrl = (key) => {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${PUBLIC_SITE_URL}/${encodedKey}`;
};

const getJwtClaims = (event) => event.requestContext?.authorizer?.jwt?.claims || {};

const getGroupsFromClaims = (claims) => {
  const groups = claims["cognito:groups"];

  if (Array.isArray(groups)) {
    return groups;
  }

  if (typeof groups === "string") {
    return groups.split(",").map((group) => group.trim()).filter(Boolean);
  }

  return [];
};

const getCaller = (event) => {
  const claims = getJwtClaims(event);
  const groups = getGroupsFromClaims(claims);

  return {
    claims,
    groups,
    role: groups.includes("Admins") || groups.includes("Admin") ? "admin" : "user",
    email: claims.email || "",
    isAuthenticated: Boolean(claims.sub)
  };
};

const requireGroups = (event, allowedGroups = []) => {
  if (AUTH_MODE !== "cognito") {
    return null;
  }

  const caller = getCaller(event);

  if (!caller.isAuthenticated) {
    return response(401, {
      ok: false,
      message: "Authentication required"
    });
  }

  if (!allowedGroups.some((group) => caller.groups.includes(group))) {
    return response(403, {
      ok: false,
      message: "You do not have permission to access this resource"
    });
  }

  return null;
};

const uploadAttachment = async (ticketId, attachment) => {
  if (!attachment?.data) {
    return null;
  }

  const contentType = attachment.contentType || "application/octet-stream";

  if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
    throw new Error("Attachment type is not allowed.");
  }

  const buffer = Buffer.from(attachment.data, "base64");

  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment is larger than 2 MB.");
  }

  const fileName = safeFileName(attachment.fileName);
  const key = `${ATTACHMENT_PREFIX}/${ticketId}/${Date.now()}-${fileName}`;

  await s3.send(new PutObjectCommand({
    Bucket: ATTACHMENT_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: {
      ticketId
    }
  }));

  return {
    key,
    url: publicObjectUrl(key),
    fileName,
    contentType,
    size: buffer.length
  };
};

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path || "";

    if (method === "OPTIONS") {
      return response(200, { ok: true });
    }

    if (method === "POST" && path.endsWith("/tickets")) {
      const authError = requireGroups(event, ["Users", "User", "Admins", "Admin"]);
      if (authError) {
        return authError;
      }

      const payload = JSON.parse(event.body || "{}");
      const ticketId = createTicketId();
      const now = new Date().toISOString();
      const attachment = await uploadAttachment(ticketId, payload.attachment);

      const ticket = {
        ticketId,
        fullName: payload.fullName || "",
        email: payload.email || "",
        category: payload.category || "",
        priority: payload.priority || "Medium",
        location: payload.location || "",
        description: payload.description || "",
        status: "Open",
        resolutionNote: "",
        createdAt: now,
        updatedAt: now,
        ...(attachment ? { attachment } : {})
      };

      await dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: ticket
      }));

      return response(201, {
        ok: true,
        ticket
      });
    }

    if (method === "GET" && path.includes("/tickets/")) {
      const authError = requireGroups(event, ["Users", "User", "Admins", "Admin"]);
      if (authError) {
        return authError;
      }

      const caller = getCaller(event);
      const ticketId = decodeURIComponent(path.split("/tickets/")[1]);
      const result = await dynamo.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { ticketId }
      }));

      if (!result.Item) {
        return response(404, {
          ok: false,
          message: "Ticket not found"
        });
      }

      if (AUTH_MODE === "cognito" && caller.role !== "admin" && caller.email && result.Item.email !== caller.email) {
        return response(403, {
          ok: false,
          message: "You can only view your own ticket"
        });
      }

      return response(200, {
        ok: true,
        ticket: result.Item
      });
    }

    if (method === "GET" && path.endsWith("/tickets")) {
      const authError = requireGroups(event, ["Admins", "Admin"]);
      if (authError) {
        return authError;
      }

      const result = await dynamo.send(new ScanCommand({
        TableName: TABLE_NAME
      }));

      const tickets = (result.Items || []).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      return response(200, {
        ok: true,
        tickets
      });
    }


    if (method === "DELETE" && path.includes("/tickets/")) {
      const authError = requireGroups(event, ["Admins", "Admin"]);
      if (authError) {
        return authError;
      }

      const ticketId = decodeURIComponent(path.split("/tickets/")[1]);
      const existing = await dynamo.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { ticketId }
      }));

      if (!existing.Item) {
        return response(404, {
          ok: false,
          message: "Ticket not found"
        });
      }

      await dynamo.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { ticketId }
      }));

      return response(200, {
        ok: true,
        ticketId
      });
    }

    if (method === "PATCH" && path.includes("/tickets/")) {
      const authError = requireGroups(event, ["Admins", "Admin"]);
      if (authError) {
        return authError;
      }

      const ticketId = decodeURIComponent(path.split("/tickets/")[1]);
      const payload = JSON.parse(event.body || "{}");

      const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { ticketId },
        UpdateExpression: "SET #status = :status, resolutionNote = :note, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":status": payload.status || "In Progress",
          ":note": payload.resolutionNote || "",
          ":updatedAt": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      }));

      return response(200, {
        ok: true,
        ticket: result.Attributes
      });
    }

    return response(404, {
      ok: false,
      message: "Route not found"
    });
  } catch (error) {
    console.error(error);

    return response(500, {
      ok: false,
      message: error.message
    });
  }
};
