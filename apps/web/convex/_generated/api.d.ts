/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth__codeService from "../auth/_codeService.js";
import type * as auth__oauthShared from "../auth/_oauthShared.js";
import type * as auth_actions from "../auth/actions.js";
import type * as auth_appUrl from "../auth/appUrl.js";
import type * as auth_claimGrants from "../auth/claimGrants.js";
import type * as auth_constants from "../auth/constants.js";
import type * as auth_crypto from "../auth/crypto.js";
import type * as auth_email from "../auth/email.js";
import type * as auth_grantStore from "../auth/grantStore.js";
import type * as auth_mutations from "../auth/mutations.js";
import type * as auth_passwordReset from "../auth/passwordReset.js";
import type * as auth_passwordResetInternal from "../auth/passwordResetInternal.js";
import type * as auth_queries from "../auth/queries.js";
import type * as auth_rateLimit from "../auth/rateLimit.js";
import type * as auth_storage from "../auth/storage.js";
import type * as auth_storageInternal from "../auth/storageInternal.js";
import type * as auth_tokenVault from "../auth/tokenVault.js";
import type * as auth_validators from "../auth/validators.js";
import type * as auth_verification from "../auth/verification.js";
import type * as auth_verificationInternal from "../auth/verificationInternal.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as oauth_google_authorize from "../oauth/google/authorize.js";
import type * as oauth_google_callback from "../oauth/google/callback.js";
import type * as spaces_actions from "../spaces/actions.js";
import type * as spaces_constants from "../spaces/constants.js";
import type * as spaces_mutations from "../spaces/mutations.js";
import type * as spaces_queries from "../spaces/queries.js";
import type * as spaces_templates from "../spaces/templates.js";
import type * as spaces_validators from "../spaces/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/_codeService": typeof auth__codeService;
  "auth/_oauthShared": typeof auth__oauthShared;
  "auth/actions": typeof auth_actions;
  "auth/appUrl": typeof auth_appUrl;
  "auth/claimGrants": typeof auth_claimGrants;
  "auth/constants": typeof auth_constants;
  "auth/crypto": typeof auth_crypto;
  "auth/email": typeof auth_email;
  "auth/grantStore": typeof auth_grantStore;
  "auth/mutations": typeof auth_mutations;
  "auth/passwordReset": typeof auth_passwordReset;
  "auth/passwordResetInternal": typeof auth_passwordResetInternal;
  "auth/queries": typeof auth_queries;
  "auth/rateLimit": typeof auth_rateLimit;
  "auth/storage": typeof auth_storage;
  "auth/storageInternal": typeof auth_storageInternal;
  "auth/tokenVault": typeof auth_tokenVault;
  "auth/validators": typeof auth_validators;
  "auth/verification": typeof auth_verification;
  "auth/verificationInternal": typeof auth_verificationInternal;
  crons: typeof crons;
  http: typeof http;
  "oauth/google/authorize": typeof oauth_google_authorize;
  "oauth/google/callback": typeof oauth_google_callback;
  "spaces/actions": typeof spaces_actions;
  "spaces/constants": typeof spaces_constants;
  "spaces/mutations": typeof spaces_mutations;
  "spaces/queries": typeof spaces_queries;
  "spaces/templates": typeof spaces_templates;
  "spaces/validators": typeof spaces_validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
