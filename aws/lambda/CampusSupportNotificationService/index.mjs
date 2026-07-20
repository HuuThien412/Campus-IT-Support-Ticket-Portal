import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

const ses = new SESClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FROM_EMAIL = process.env.FROM_EMAIL || "";
const IT_TEAM_EMAIL = process.env.IT_TEAM_EMAIL || "";
const APP_BASE_URL = (process.env.APP_BASE_URL || "https://main.d37atxjbyyp60m.amplifyapp.com").replace(/\/$/, "");
const NOTIFICATION_ENABLED = String(process.env.NOTIFICATION_ENABLED || "true").toLowerCase() === "true";
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || "CampusSupportConnections";
const WEBSOCKET_MANAGEMENT_ENDPOINT = (process.env.WEBSOCKET_MANAGEMENT_ENDPOINT || "").replace(/\/$/, "");
const HIGH_PRIORITY_VALUES = new Set(["High", "Critical"]);

const attributeValueToJs = (attribute) => {
  if (!attribute) {
    return undefined;
  }

  if ("S" in attribute) return attribute.S;
  if ("N" in attribute) return Number(attribute.N);
  if ("BOOL" in attribute) return attribute.BOOL;
  if ("NULL" in attribute) return null;

  if ("M" in attribute) {
    return Object.fromEntries(
      Object.entries(attribute.M).map(([key, value]) => [key, attributeValueToJs(value)])
    );
  }

  if ("L" in attribute) {
    return attribute.L.map(attributeValueToJs);
  }

  return undefined;
};

const streamImageToTicket = (image = {}) =>
  Object.fromEntries(
    Object.entries(image).map(([key, value]) => [key, attributeValueToJs(value)])
  );

const formatTicketUrl = (ticketId) => `${APP_BASE_URL}/#ticket-${encodeURIComponent(ticketId || "")}`;

const isHighPriority = (ticket) => HIGH_PRIORITY_VALUES.has(ticket.priority);

const statusChanged = (oldTicket, newTicket) =>
  Boolean(oldTicket?.status && newTicket?.status && oldTicket.status !== newTicket.status);

const noteChanged = (oldTicket, newTicket) =>
  String(oldTicket?.resolutionNote || "") !== String(newTicket?.resolutionNote || "");

const buildTextBody = (lines) => lines.filter(Boolean).join("\n");

const sendEmail = async ({ to, subject, text }) => {
  if (!NOTIFICATION_ENABLED) {
    console.info("Notification disabled. Skipping email:", { to, subject });
    return;
  }

  if (!FROM_EMAIL) {
    throw new Error("Missing FROM_EMAIL environment variable.");
  }

  if (!to) {
    console.warn("Skipping email because recipient is empty.", { subject });
    return;
  }

  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Charset: "UTF-8",
        Data: subject
      },
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: text
        }
      }
    }
  }));
};

const deleteStaleConnection = async (connectionId) => {
  await dynamo.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId }
  }));
};

const postToConnections = async (connections, payload) => {
  if (!connections?.length) return;

  const client = new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_MANAGEMENT_ENDPOINT
  });
  const data = Buffer.from(JSON.stringify(payload));

  await Promise.all(connections.map(async ({ connectionId }) => {
    try {
      await client.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: data
      }));
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 410 || error.name === "GoneException") {
        await deleteStaleConnection(connectionId);
        return;
      }
      throw error;
    }
  }));
};

const pushTicketCreated = async (ticket) => {
  if (!WEBSOCKET_MANAGEMENT_ENDPOINT) {
    console.info("Skipping ticket.created because the WebSocket endpoint is missing.", {
      ticketId: ticket.ticketId
    });
    return;
  }

  const result = await dynamo.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: "#role = :role",
    ExpressionAttributeNames: { "#role": "role" },
    ExpressionAttributeValues: { ":role": "admin" },
    ProjectionExpression: "connectionId"
  }));

  if (!result.Items?.length) {
    console.info("No active Admin WebSocket connection found for the new ticket.", {
      ticketId: ticket.ticketId
    });
    return;
  }

  const createdAt = ticket.createdAt || new Date().toISOString();
  await postToConnections(result.Items, {
    type: "ticket.created",
    ticketId: ticket.ticketId,
    createdAt,
    ticket: {
      ticketId: ticket.ticketId,
      fullName: ticket.fullName,
      email: ticket.email,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      location: ticket.location,
      description: ticket.description,
      createdAt
    }
  });
};

const pushTicketUpdated = async (oldTicket, newTicket) => {
  if (!WEBSOCKET_MANAGEMENT_ENDPOINT || !newTicket.email) {
    console.info("Skipping real-time notification because its configuration is incomplete.", {
      ticketId: newTicket.ticketId
    });
    return;
  }

  const result = await dynamo.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": newTicket.email
    },
    ProjectionExpression: "connectionId"
  }));

  if (!result.Items?.length) {
    console.info("No active WebSocket connection found for ticket owner.", {
      ticketId: newTicket.ticketId,
      email: newTicket.email
    });
    return;
  }

  const updatedAt = newTicket.updatedAt || new Date().toISOString();
  await postToConnections(result.Items, {
    type: "ticket.updated",
    ticketId: newTicket.ticketId,
    status: newTicket.status,
    previousStatus: oldTicket.status,
    resolutionNote: newTicket.resolutionNote || "",
    updatedAt,
    ticket: {
      ticketId: newTicket.ticketId,
      status: newTicket.status,
      priority: newTicket.priority,
      category: newTicket.category,
      resolutionNote: newTicket.resolutionNote || "",
      updatedAt
    }
  });
};

const sendTicketCreatedEmail = (ticket) =>
  sendEmail({
    to: ticket.email,
    subject: `[Campus Support] Ticket ${ticket.ticketId} da duoc ghi nhan`,
    text: buildTextBody([
      `Xin chao ${ticket.fullName || "ban"},`,
      "",
      "Yeu cau ho tro IT cua ban da duoc ghi nhan.",
      `Ma ticket: ${ticket.ticketId}`,
      `Nhom su co: ${ticket.category || "N/A"}`,
      `Muc do uu tien: ${ticket.priority || "N/A"}`,
      `Trang thai hien tai: ${ticket.status || "Open"}`,
      ticket.location ? `Vi tri: ${ticket.location}` : "",
      "",
      "Ban co the tra cuu trang thai ticket tren cong ho tro:",
      formatTicketUrl(ticket.ticketId),
      "",
      "Campus Support Team"
    ])
  });

const sendHighPriorityEmail = (ticket) =>
  sendEmail({
    to: IT_TEAM_EMAIL,
    subject: `[Campus Support][${ticket.priority}] Ticket ${ticket.ticketId} can xu ly`,
    text: buildTextBody([
      "Co ticket uu tien cao vua duoc tao.",
      "",
      `Ma ticket: ${ticket.ticketId}`,
      `Nguoi gui: ${ticket.fullName || "N/A"} <${ticket.email || "N/A"}>`,
      `Nhom su co: ${ticket.category || "N/A"}`,
      `Muc do uu tien: ${ticket.priority || "N/A"}`,
      `Vi tri: ${ticket.location || "N/A"}`,
      "",
      "Mo ta:",
      ticket.description || "N/A",
      "",
      "Trang admin:",
      `${APP_BASE_URL}/admin/`
    ])
  });

const sendTicketUpdatedEmail = (oldTicket, newTicket) =>
  sendEmail({
    to: newTicket.email,
    subject: `[Campus Support] Ticket ${newTicket.ticketId} da cap nhat trang thai`,
    text: buildTextBody([
      `Xin chao ${newTicket.fullName || "ban"},`,
      "",
      `Ticket ${newTicket.ticketId} cua ban da duoc cap nhat.`,
      statusChanged(oldTicket, newTicket)
        ? `Trang thai: ${oldTicket.status} -> ${newTicket.status}`
        : `Trang thai hien tai: ${newTicket.status || "N/A"}`,
      newTicket.resolutionNote ? `Ghi chu tu IT: ${newTicket.resolutionNote}` : "",
      "",
      "Ban co the tra cuu trang thai moi nhat tren cong ho tro:",
      formatTicketUrl(newTicket.ticketId),
      "",
      "Campus Support Team"
    ])
  });

const handleInsert = async (ticket) => {
  const tasks = [
    sendTicketCreatedEmail(ticket),
    pushTicketCreated(ticket)
  ];

  if (isHighPriority(ticket) && IT_TEAM_EMAIL) {
    tasks.push(sendHighPriorityEmail(ticket));
  }

  await Promise.all(tasks);
};

const handleModify = async (oldTicket, newTicket) => {
  if (!statusChanged(oldTicket, newTicket) && !noteChanged(oldTicket, newTicket)) {
    console.info("Skipping MODIFY notification because status/note did not change.", {
      ticketId: newTicket.ticketId
    });
    return;
  }

  await sendTicketUpdatedEmail(oldTicket, newTicket);
  await pushTicketUpdated(oldTicket, newTicket);
};

export const handler = async (event) => {
  const failures = [];

  for (const record of event.Records || []) {
    try {
      if (record.eventName === "INSERT") {
        await handleInsert(streamImageToTicket(record.dynamodb?.NewImage));
      }

      if (record.eventName === "MODIFY") {
        await handleModify(
          streamImageToTicket(record.dynamodb?.OldImage),
          streamImageToTicket(record.dynamodb?.NewImage)
        );
      }
    } catch (error) {
      console.error("Failed to process notification record.", {
        eventID: record.eventID,
        eventName: record.eventName,
        message: error.message
      });
      failures.push({ itemIdentifier: record.eventID });
    }
  }

  return {
    batchItemFailures: failures
  };
};
