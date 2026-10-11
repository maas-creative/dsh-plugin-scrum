import {getRuntimeFallbackStatusCode,getRuntimeFallbackRetryableSignal} from './independent/request-classification.mjs';
// Preserve only classification fields; provider bodies and credentials never enter the ledger.
export function requestErrorDetails(error){const statusCode=getRuntimeFallbackStatusCode(error),isRetryable=getRuntimeFallbackRetryableSignal(error);return {...(Number.isInteger(statusCode)?{statusCode}:{}),...(typeof isRetryable==='boolean'?{isRetryable}:{})}}
export function requestError(message,details){return Object.assign(new Error(message),requestErrorDetails(details))}
