import { createPublicKey, verify as verifySignature } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || "CampusSupportConnections";
const COGNITO_ISSUER = process.env.COGNITO_ISSUER || "";
const COGNITO_APP_CLIENT_ID = process.env.COGNITO_APP_CLIENT_ID || "";
const ALLOWED_GROUPS = new Set(["Users", "User", "Admins", "Admin"]);

let cachedJwks;

const response = (statusCode, body = {}) => ({
  statusCode,
  body: JSON.stringify(body)
});

const decodeBase64UrlJson = (value) =>
  JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

const getJwks = async () => {
  if (cachedJwks) {
    return cachedJwks;
  }

  const result = await fetch(`${COGNITO_ISSUER}/.well-known/jwks.json`);
  if (!result.ok) {
    throw new Error(`Unable to load Cognito signing keys (${result.status}).`);
  }

  cachedJwks = await result.json();
  return cachedJwks;
};

const verifyCognitoToken = async (token) => {
  if (!COGNITO_ISSUER || !COGNITO_APP_CLIENT_ID) {
    throw new Error("Missing Cognito environment configuration.");
  }

  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Missing or invalid Cognito token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson(encodedHeader);
  const payload = decodeBase64UrlJson(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Cognito token signing algorithm.");
  }

  const jwks = await getJwks();
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedJwks = undefined;
    throw new Error("Cognito signing key was not found.");
  }

  const isValid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url")
  );

  const now = Math.floor(Date.now() / 1000);
  const audience = payload.aud || payload.client_id;

  if (!isValid) throw new Error("Invalid Cognito token signature.");
  if (payload.iss !== COGNITO_ISSUER) throw new Error("Invalid Cognito token issuer.");
  if (audience !== COGNITO_APP_CLIENT_ID) throw new Error("Invalid Cognito app client.");
  if (!payload.exp || payload.exp <= now) throw new Error("Cognito token has expired.");

  return payload;
};

const getGroups = (claims) => {
  const groups = claims["cognito:groups"];
  if (Array.isArray(groups)) return groups;
  if (typeof groups !== "string") return [];

  try {
    const parsed = JSON.parse(groups);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Cognito can also expose groups as a comma-delimited string.
  }

  return groups.replace(/^\[|\]$/g, "").split(/[ ,]+/).filter(Boolean);
};

const handleConnect = async (event) => {
  const token = event.queryStringParameters?.idToken;
  const claims = await verifyCognitoToken(token);
  const groups = getGroups(claims);

  if (!groups.some((group) => ALLOWED_GROUPS.has(group))) {
    return response(403, { message: "User is not allowed to open a notification connection." });
  }

  const connectionId = event.requestContext.connectionId;
  const role = groups.some((group) => group === "Admins" || group === "Admin")
    ? "admin"
    : "user";

  await dynamo.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      userId: claims.sub,
      email: claims.email || "",
      role,
      connectedAt: new Date().toISOString(),
      expiresAt: claims.exp
    }
  }));

  console.info("WebSocket connection stored.", { connectionId, role });
  return response(200, { connected: true });
};

const handleDisconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;

  await dynamo.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId }
  }));

  console.info("WebSocket connection removed.", { connectionId });
  return response(200, { disconnected: true });
};

export const handler = async (event) => {
  const routeKey = event.requestContext?.routeKey;

  try {
    if (routeKey === "$connect") return await handleConnect(event);
    if (routeKey === "$disconnect") return await handleDisconnect(event);

    return response(200, { message: "No client action is required." });
  } catch (error) {
    console.error("WebSocket request failed.", {
      routeKey,
      message: error.message
    });

    return response(routeKey === "$connect" ? 401 : 500, {
      message: error.message
    });
  }
};
