/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_actions from "../auth/actions.js";
import type * as auth_constants from "../auth/constants.js";
import type * as auth_crypto from "../auth/crypto.js";
import type * as auth_mutations from "../auth/mutations.js";
import type * as auth_passwordReset from "../auth/passwordReset.js";
import type * as auth_passwordResetInternal from "../auth/passwordResetInternal.js";
import type * as auth_queries from "../auth/queries.js";
import type * as auth_storage from "../auth/storage.js";
import type * as auth_validators from "../auth/validators.js";
import type * as auth_verification from "../auth/verification.js";
import type * as auth_verificationInternal from "../auth/verificationInternal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/actions": typeof auth_actions;
  "auth/constants": typeof auth_constants;
  "auth/crypto": typeof auth_crypto;
  "auth/mutations": typeof auth_mutations;
  "auth/passwordReset": typeof auth_passwordReset;
  "auth/passwordResetInternal": typeof auth_passwordResetInternal;
  "auth/queries": typeof auth_queries;
  "auth/storage": typeof auth_storage;
  "auth/validators": typeof auth_validators;
  "auth/verification": typeof auth_verification;
  "auth/verificationInternal": typeof auth_verificationInternal;
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
