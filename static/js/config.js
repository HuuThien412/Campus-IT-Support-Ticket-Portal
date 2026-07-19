window.CAMPUS_SUPPORT_CONFIG = {
  apiBaseUrl: "https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com",
  webSocketUrl: "wss://y9d2pszfs7.execute-api.ap-southeast-1.amazonaws.com/production/",
  cognito: {
    enabled: true,
    domain: "https://ap-southeast-1dlwufncru.auth.ap-southeast-1.amazoncognito.com",
    clientId: "6b0npdra3clhdlpfen45iekr5l",
    redirectUri: `${window.location.origin}${window.location.pathname}`,
    logoutUri: `${window.location.origin}${window.location.pathname}`
  }
};
