/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account_actions from "../account/actions.js";
import type * as account_store from "../account/store.js";
import type * as auth__codeService from "../auth/_codeService.js";
import type * as auth__oauthShared from "../auth/_oauthShared.js";
import type * as auth_actions from "../auth/actions.js";
import type * as auth_appUrl from "../auth/appUrl.js";
import type * as auth_claimGrants from "../auth/claimGrants.js";
import type * as auth_constants from "../auth/constants.js";
import type * as auth_crypto from "../auth/crypto.js";
import type * as auth_email from "../auth/email.js";
import type * as auth_emailCopy from "../auth/emailCopy.js";
import type * as auth_grantStore from "../auth/grantStore.js";
import type * as auth_mutations from "../auth/mutations.js";
import type * as auth_passwordReset from "../auth/passwordReset.js";
import type * as auth_passwordResetInternal from "../auth/passwordResetInternal.js";
import type * as auth_queries from "../auth/queries.js";
import type * as auth_rateLimit from "../auth/rateLimit.js";
import type * as auth_sessionStore from "../auth/sessionStore.js";
import type * as auth_sessions from "../auth/sessions.js";
import type * as auth_storage from "../auth/storage.js";
import type * as auth_storageInternal from "../auth/storageInternal.js";
import type * as auth_tokenVault from "../auth/tokenVault.js";
import type * as auth_validators from "../auth/validators.js";
import type * as auth_verification from "../auth/verification.js";
import type * as auth_verificationInternal from "../auth/verificationInternal.js";
import type * as calendar_events from "../calendar/events.js";
import type * as calendar_model from "../calendar/model.js";
import type * as calendar_time from "../calendar/time.js";
import type * as crons from "../crons.js";
import type * as gallery_data from "../gallery/data.js";
import type * as gallery_files from "../gallery/files.js";
import type * as gallery_model from "../gallery/model.js";
import type * as gallery_processing from "../gallery/processing.js";
import type * as gallery_sniff from "../gallery/sniff.js";
import type * as gallery_store from "../gallery/store.js";
import type * as gallery_uploads from "../gallery/uploads.js";
import type * as http from "../http.js";
import type * as lists_access from "../lists/access.js";
import type * as lists_data from "../lists/data.js";
import type * as lists_maintenance from "../lists/maintenance.js";
import type * as lists_model from "../lists/model.js";
import type * as lists_session from "../lists/session.js";
import type * as lists_templates from "../lists/templates.js";
import type * as lists_validation from "../lists/validation.js";
import type * as notes_data from "../notes/data.js";
import type * as notes_model from "../notes/model.js";
import type * as oauth_google_authorize from "../oauth/google/authorize.js";
import type * as oauth_google_callback from "../oauth/google/callback.js";
import type * as spaces_actions from "../spaces/actions.js";
import type * as spaces_constants from "../spaces/constants.js";
import type * as spaces_create from "../spaces/create.js";
import type * as spaces_creation from "../spaces/creation.js";
import type * as spaces_dashboard from "../spaces/dashboard.js";
import type * as spaces_dashboardStore from "../spaces/dashboardStore.js";
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
  "account/actions": typeof account_actions;
  "account/store": typeof account_store;
  "auth/_codeService": typeof auth__codeService;
  "auth/_oauthShared": typeof auth__oauthShared;
  "auth/actions": typeof auth_actions;
  "auth/appUrl": typeof auth_appUrl;
  "auth/claimGrants": typeof auth_claimGrants;
  "auth/constants": typeof auth_constants;
  "auth/crypto": typeof auth_crypto;
  "auth/email": typeof auth_email;
  "auth/emailCopy": typeof auth_emailCopy;
  "auth/grantStore": typeof auth_grantStore;
  "auth/mutations": typeof auth_mutations;
  "auth/passwordReset": typeof auth_passwordReset;
  "auth/passwordResetInternal": typeof auth_passwordResetInternal;
  "auth/queries": typeof auth_queries;
  "auth/rateLimit": typeof auth_rateLimit;
  "auth/sessionStore": typeof auth_sessionStore;
  "auth/sessions": typeof auth_sessions;
  "auth/storage": typeof auth_storage;
  "auth/storageInternal": typeof auth_storageInternal;
  "auth/tokenVault": typeof auth_tokenVault;
  "auth/validators": typeof auth_validators;
  "auth/verification": typeof auth_verification;
  "auth/verificationInternal": typeof auth_verificationInternal;
  "calendar/events": typeof calendar_events;
  "calendar/model": typeof calendar_model;
  "calendar/time": typeof calendar_time;
  crons: typeof crons;
  "gallery/data": typeof gallery_data;
  "gallery/files": typeof gallery_files;
  "gallery/model": typeof gallery_model;
  "gallery/processing": typeof gallery_processing;
  "gallery/sniff": typeof gallery_sniff;
  "gallery/store": typeof gallery_store;
  "gallery/uploads": typeof gallery_uploads;
  http: typeof http;
  "lists/access": typeof lists_access;
  "lists/data": typeof lists_data;
  "lists/maintenance": typeof lists_maintenance;
  "lists/model": typeof lists_model;
  "lists/session": typeof lists_session;
  "lists/templates": typeof lists_templates;
  "lists/validation": typeof lists_validation;
  "notes/data": typeof notes_data;
  "notes/model": typeof notes_model;
  "oauth/google/authorize": typeof oauth_google_authorize;
  "oauth/google/callback": typeof oauth_google_callback;
  "spaces/actions": typeof spaces_actions;
  "spaces/constants": typeof spaces_constants;
  "spaces/create": typeof spaces_create;
  "spaces/creation": typeof spaces_creation;
  "spaces/dashboard": typeof spaces_dashboard;
  "spaces/dashboardStore": typeof spaces_dashboardStore;
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
