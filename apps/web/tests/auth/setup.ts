// Test-only environment. These are throwaway values for the in-process mock
// backend: nothing here ever leaves the test process, and no real provider is
// contacted (RESEND_API_KEY is unset on purpose so delivery-failure paths are
// deterministic without network access).
process.env.EMAIL_CODE_PEPPER = "test-pepper-0123456789abcdef-test-pepper";
process.env.OAUTH_STATE_SECRET = "test-oauth-state-secret-0123456789";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
// Public app origin the backend builds redirect links from (fail-closed when absent).
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3002";
delete process.env.RESEND_API_KEY;
