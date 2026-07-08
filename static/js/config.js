window.CAMPUS_SUPPORT_CONFIG = {
  apiBaseUrl: "https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com",
  cognito: {
    enabled: false,
    domain: "",
    clientId: "",
    redirectUri: `${window.location.origin}${window.location.pathname}`,
    logoutUri: `${window.location.origin}${window.location.pathname}`
  }
};
