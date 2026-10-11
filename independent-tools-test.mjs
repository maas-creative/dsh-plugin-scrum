import test from 'node:test';import assert from 'node:assert/strict';
import {requestErrorDetails} from './request-error.mjs';
import {calculateTargetDimensions} from './independent/image-size.mjs';
test('error classification stops cycles and emits no provider credentials',()=>{const error={statusCode:429,isRetryable:true,body:{token:'private'}};error.cause=error;assert.deepEqual(requestErrorDetails(error),{statusCode:429,isRetryable:true});assert.deepEqual(requestErrorDetails({cause:{status:400,retryable:false}}),{statusCode:400,isRetryable:false});assert.deepEqual(requestErrorDetails({statusCode:'401',isRetryable:'true'}),{});});
test('image scaling preserves aspect ratio and rejects invalid dimensions',()=>{assert.deepEqual(calculateTargetDimensions(3136,1568),{width:1568,height:784});assert.equal(calculateTargetDimensions(100,100),null);assert.equal(calculateTargetDimensions(Infinity,100),null);assert.equal(calculateTargetDimensions(-1,100),null);});
