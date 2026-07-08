import { writeFileSync } from "node:fs";

const apiBaseUrl = process.env.API_BASE_URL || "https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com";
const cognitoEnabled = String(process.env.COGNITO_ENABLED || "false").toLowerCase() === "true";
const cognitoDomain = process.env.COGNITO_DOMAIN || "";
const cognitoClientId = process.env.COGNITO_CLIENT_ID || "";
const cognitoRedirectUri = process.env.COGNITO_REDIRECT_URI
  ? JSON.stringify(process.env.COGNITO_REDIRECT_URI)
  : "`${window.location.origin}${window.location.pathname}`";
const cognitoLogoutUri = process.env.COGNITO_LOGOUT_URI
  ? JSON.stringify(process.env.COGNITO_LOGOUT_URI)
  : "`${window.location.origin}${window.location.pathname}`";

const config = `window.CAMPUS_SUPPORT_CONFIG = {
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  cognito: {
    enabled: ${cognitoEnabled},
    domain: ${JSON.stringify(cognitoDomain)},
    clientId: ${JSON.stringify(cognitoClientId)},
    redirectUri: ${cognitoRedirectUri},
    logoutUri: ${cognitoLogoutUri}
  }
};
`;

writeFileSync("static/js/config.js", config, "utf8");
